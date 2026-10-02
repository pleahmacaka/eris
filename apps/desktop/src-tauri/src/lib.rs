use std::sync::atomic::Ordering;

use tauri::{AppHandle, DeviceEventFilter, Manager, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_store::StoreExt;

use crate::features::{release_shell, start_dock, stored_features, DOCK_ON, LAUNCHER_ON};
use crate::shortcuts::set_launcher_shortcut;

mod appbar;
mod apps;
mod audio;
mod clipboard;
mod commands;
mod desktop;
mod edge;
mod edit;
mod eris_files;
mod features;
mod icons;
mod media;
mod meters;
mod monitors;
mod note;
mod notices;
mod notify;
mod outside;
mod p2p;
mod pins;
mod preview;
mod quick;
mod share;
mod shortcuts;
mod spectrum;
mod system;
mod usage;
mod windowing;
mod winkey;

pub fn trace(message: &str) {
    use std::io::Write;

    let path = std::env::temp_dir().join("eris-hook.log");

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_millis())
        .unwrap_or_default();

    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let _ = writeln!(file, "{stamp} {message}");
    }
}

const QUIET_LOGS: [&str; 6] = [
    "iroh",
    "iroh_quinn",
    "iroh_relay",
    "netwatch",
    "portmapper",
    "tracing::span",
];

fn onboarded(app: &AppHandle) -> bool {
    app.store("settings.json")
        .ok()
        .and_then(|store| store.get("device"))
        .and_then(|device| device.get("onboarded")?.as_bool())
        .unwrap_or(false)
}

// the installer swaps the exe on rename but leaves the Run key and statusLine on the old path
fn follow_exe(app: &AppHandle) {
    usage::repoint_usage_bridge();

    let launch = app.autolaunch();

    if launch.is_enabled().unwrap_or(false) {
        let _ = launch.enable();
    }
}

fn open(app: &AppHandle) {
    windowing::conceal_hidden(app);

    let features = stored_features(app);

    DOCK_ON.store(features.dock, Ordering::Relaxed);
    LAUNCHER_ON.store(features.launcher, Ordering::Relaxed);

    if features.dock {
        start_dock(app);
    } else {
        windowing::hide(app, "taskbar");
    }

    if !onboarded(app) {
        windowing::show(app, "onboarding");
    }
}

// tauri keys the data folder by identifier, so carry the pre-rename folder over once
fn adopt_previous_data() {
    let Some(roaming) = std::env::var_os("APPDATA").map(std::path::PathBuf::from) else {
        return;
    };
    let previous = roaming.join("com.eris.app");
    let current = roaming.join("com.arixlab.eris.windows");

    if current.exists() || !previous.is_dir() {
        return;
    }

    let _ = std::fs::rename(previous, current);
}

fn logger() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    QUIET_LOGS
        .iter()
        .fold(
            tauri_plugin_log::Builder::default().level(log::LevelFilter::Info),
            |builder, target| builder.level_for(*target, log::LevelFilter::Warn),
        )
        .max_file_size(1_000_000)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
        .build()
}

pub fn run() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if let Some(code) = tauri_plugin_eris_files::default_app::cli(&eris_files::HOST, &args) {
        std::process::exit(code);
    }

    if args.iter().any(|arg| arg == "--usage-bridge") {
        let chain = args
            .iter()
            .skip_while(|arg| *arg != "--chain")
            .nth(1)
            .cloned();

        return usage::bridge(chain);
    }

    // a second launch forwards to the running instance, which may only raise its window with this grant
    let _ = unsafe {
        windows::Win32::UI::WindowsAndMessaging::AllowSetForegroundWindow(
            windows::Win32::UI::WindowsAndMessaging::ASFW_ANY,
        )
    };

    adopt_previous_data();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if tauri_plugin_eris_files::claims(&eris_files::HOST, &args) {
                tauri_plugin_eris_files::forward(app, args, cwd);

                return;
            }

            let label = if !onboarded(app) {
                "onboarding"
            } else if LAUNCHER_ON.load(Ordering::Relaxed) {
                "main"
            } else {
                "settings"
            };

            windowing::show(app, label);
        }))
        .plugin(logger())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_eris_terminal::init("/terminal"))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_eris_files::init(eris_files::HOST))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(commands::handler());

    #[cfg(debug_assertions)]
    let builder = builder.plugin(tauri_plugin_mcp_bridge::init());

    builder
        .setup(move |app| {
            let handle = app.handle().clone();

            if !cfg!(debug_assertions) {
                follow_exe(&handle);
            }

            // windows skips a low level keyboard hook whose process registered for raw input
            handle.set_device_event_filter(DeviceEventFilter::Always);

            notify::host(handle.clone());
            winkey::install(handle.clone());
            clipboard::watch(handle.clone());
            desktop::watch(handle.clone());
            usage::watch(handle.clone());
            apps::watch(handle.clone());
            share::watch(handle.clone());
            p2p::start(&handle);

            if tauri_plugin_eris_files::claims(&eris_files::HOST, &args) {
                let cwd = std::env::current_dir().unwrap_or_default();

                tauri_plugin_eris_files::start(&handle, args, &cwd);
            }

            let features = stored_features(&handle);

            if features.launcher {
                let _ = set_launcher_shortcut(handle.clone(), Some("Alt+Space".into()));
            }

            if let Some(main) = app.get_webview_window("main") {
                main.on_window_event({
                    let main = main.clone();

                    move |event| {
                        if matches!(event, WindowEvent::Focused(false)) {
                            windowing::hide_on_blur(&main);
                        }
                    }
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            tauri::RunEvent::Ready => open(app),
            tauri::RunEvent::Exit => release_shell(app),
            _ => {}
        });
}
