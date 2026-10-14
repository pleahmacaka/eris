use std::sync::atomic::Ordering;

use tauri::{AppHandle, DeviceEventFilter, Listener, Manager, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_store::StoreExt;

use crate::shell::features::{
    release_shell, start_dock, stored_features, sync_topbar, DOCK_ON, LAUNCHER_ON,
};
use crate::shell::shortcuts::set_launcher_shortcut;

mod apps;
mod clipboard;
mod commands;
mod data;
mod note;
mod notifications;
mod shell;
mod system;
mod theme_link;
mod usage;

use apps::{files, launcher};
use eris_p2p as p2p;
use shell::{desktop, windowing, winkey};
use system::share;

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
    sync_topbar(app);

    if eris_window_kit::headless() {
        return;
    }

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

    if let Some(code) = tauri_plugin_eris_files::default_app::cli(&files::HOST, &args) {
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

    let stable = eris_window_kit::CHANNEL == eris_window_kit::Channel::Stable;

    if stable {
        adopt_previous_data();
    }

    let builder = tauri::Builder::default()
        .plugin(eris_window_kit::development())
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            if tauri_plugin_eris_auth::claims(&args) {
                return;
            }

            if let Some(link) = theme_link::link(&args) {
                theme_link::accept(app, link);

                return;
            }

            if tauri_plugin_eris_files::claims(&files::HOST, &args) {
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
        .plugin(tauri_plugin_eris_auth::init("eris"))
        .plugin(tauri_plugin_eris_files::init(files::HOST))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(commands::handler());

    #[cfg(feature = "mcp-bridge")]
    let builder = builder.plugin(tauri_plugin_mcp_bridge::init());

    builder
        .setup(move |app| {
            let handle = app.handle().clone();

            #[cfg(feature = "mcp-bridge")]
            app.add_capability(
                tauri::ipc::CapabilityBuilder::new("mcp-bridge")
                    .window("*")
                    .permission("mcp-bridge:default"),
            )?;

            if stable {
                follow_exe(&handle);
            }

            // windows skips a low level keyboard hook whose process registered for raw input
            handle.set_device_event_filter(DeviceEventFilter::Always);

            if !eris_window_kit::headless() {
                shell::priority::start(&handle);
                winkey::install(handle.clone());
                clipboard::watch(handle.clone());
            }
            desktop::watch(handle.clone());
            launcher::watch(handle.clone());

            handle.listen_any("store://change", {
                let handle = handle.clone();

                move |event| {
                    let device = serde_json::from_str::<serde_json::Value>(event.payload())
                        .is_ok_and(|change| change["key"] == "device");

                    // the store emits while it holds its own locks, so reading it here would deadlock
                    if device {
                        let handle = handle.clone();

                        std::thread::spawn(move || sync_topbar(&handle));
                    }
                }
            });

            share::watch(handle.clone());
            if let Some(id) = tauri_plugin_eris_files::endpoint_id(&handle) {
                p2p::set_files(id);
            }

            p2p::start(&handle);

            if let Some(link) = theme_link::link(&args) {
                theme_link::accept(&handle, link);
            }

            if tauri_plugin_eris_files::claims(&files::HOST, &args) {
                let cwd = std::env::current_dir().unwrap_or_default();

                tauri_plugin_eris_files::start(&handle, args, &cwd);
            }

            let features = stored_features(&handle);

            if features.launcher && !eris_window_kit::headless() {
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
            tauri::RunEvent::Exit => {
                clipboard::flush(app);
                release_shell(app);
            }
            _ => {}
        });
}
