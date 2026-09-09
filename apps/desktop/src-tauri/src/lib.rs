use std::sync::atomic::Ordering;

use tauri::{AppHandle, DeviceEventFilter, Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_store::StoreExt;

use crate::features::{start_dock, stored_features, CHAT_ON, DOCK_ON, LAUNCHER_ON};
use crate::shortcuts::{set_chat_shortcut, set_launcher_shortcut};

mod appbar;
mod apps;
mod audio;
mod chat_window;
mod claude;
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
mod notices;
mod notify;
mod preview;
mod quick;
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

fn open(app: &AppHandle) {
    windowing::conceal_hidden(app);

    let features = stored_features(app);

    DOCK_ON.store(features.dock, Ordering::Relaxed);
    LAUNCHER_ON.store(features.launcher, Ordering::Relaxed);
    CHAT_ON.store(features.chat, Ordering::Relaxed);

    if features.dock {
        start_dock(app);
    } else {
        windowing::hide(app, "taskbar");
    }

    let hidden = std::env::args().any(|arg| arg == "--hidden");

    if !hidden && features.chat {
        windowing::show(app, "chat");
    }

    if !onboarded(app) {
        windowing::show(app, "onboarding");
    } else if !hidden && features.launcher {
        windowing::show(app, "main");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if LAUNCHER_ON.load(Ordering::Relaxed) {
                windowing::show(app, "main");
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(commands::handler())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();

            // windows skips a low level keyboard hook whose process registered for raw input
            handle.set_device_event_filter(DeviceEventFilter::Always);

            notify::host(handle.clone());
            winkey::install(handle.clone());
            clipboard::watch(handle.clone());

            let _ = set_launcher_shortcut(handle.clone(), Some("Alt+Space".into()));

            let _ = set_chat_shortcut(handle.clone(), Some("Ctrl+Space".into()));

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
                if let Some(taskbar) = app.get_webview_window("taskbar") {
                    appbar::release(&taskbar);
                }

                notify::release();
                winkey::release();
            }
            _ => {}
        });
}
