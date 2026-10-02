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
mod features;
mod files;
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

pub fn usage_bridge(chain: Option<String>) {
    usage::bridge(chain);
}

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            let label = if !onboarded(app) {
                "onboarding"
            } else if LAUNCHER_ON.load(Ordering::Relaxed) {
                "main"
            } else {
                "settings"
            };

            windowing::show(app, label);
        }))
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(commands::handler());

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

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
            share::watch(handle.clone());
            usage::watch(handle.clone());
            p2p::start(&handle);

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
