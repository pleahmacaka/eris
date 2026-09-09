use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, DeviceEventFilter, Emitter, Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_store::StoreExt;

mod appbar;
mod apps;
mod audio;
mod clipboard;
mod desktop;
mod edge;
mod files;
mod icons;
mod media;
mod meters;
mod monitors;
mod notices;
mod notify;
mod preview;
mod claude;
mod edit;
mod quick;
mod spectrum;
mod system;
mod usage;
mod windowing;
mod winkey;

static LAUNCHER_SHORTCUT: Mutex<Option<String>> = Mutex::new(None);
static CHAT_SHORTCUT: Mutex<Option<String>> = Mutex::new(None);
static DOCK_ON: AtomicBool = AtomicBool::new(true);
static LAUNCHER_ON: AtomicBool = AtomicBool::new(true);
static CHAT_ON: AtomicBool = AtomicBool::new(true);
static EDGE_WATCHING: AtomicBool = AtomicBool::new(false);

#[derive(serde::Deserialize)]
pub struct Features {
    dock: bool,
    launcher: bool,
    chat: bool,
}

fn stored_features(app: &AppHandle) -> Features {
    let device = app
        .store("settings.json")
        .ok()
        .and_then(|store| store.get("device"));
    let flag = |name: &str| {
        device
            .as_ref()
            .and_then(|device| device.get("features")?.get(name)?.as_bool())
            .unwrap_or(true)
    };

    Features {
        dock: flag("dock"),
        launcher: flag("launcher"),
        chat: flag("chat"),
    }
}

// the shell answers an appbar message by sending one back to the dock, so never ask from its own thread
fn start_dock(app: &AppHandle) {
    let handle = app.clone();

    std::thread::spawn(move || {
        let Some(taskbar) = handle.get_webview_window("taskbar") else {
            return;
        };

        let _ = appbar::apply(&taskbar, &appbar::stored_layout(&handle));

        if !EDGE_WATCHING.swap(true, Ordering::Relaxed) {
            edge::watch(handle);
        }
    });
}

fn dock_enabled(app: &AppHandle, on: bool) {
    if on {
        windowing::show(app, "taskbar");
        start_dock(app);

        return;
    }

    if let Some(taskbar) = app.get_webview_window("taskbar") {
        appbar::release(&taskbar);
    }

    windowing::hide(app, "taskbar");
}

#[tauri::command]
fn set_features(app: AppHandle, features: Features) {
    let dock_was = DOCK_ON.swap(features.dock, Ordering::Relaxed);
    let chat_was = CHAT_ON.swap(features.chat, Ordering::Relaxed);

    LAUNCHER_ON.store(features.launcher, Ordering::Relaxed);

    if dock_was != features.dock {
        dock_enabled(&app, features.dock);
    }

    if chat_was != features.chat {
        if features.chat {
            windowing::show(&app, "chat");
        } else {
            windowing::hide(&app, "chat");
        }
    }

    if !features.launcher {
        windowing::hide(&app, "main");
    }
}

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

#[tauri::command]
fn set_launcher_shortcut(app: AppHandle, shortcut: Option<String>) -> Result<(), String> {
    let shortcuts = app.global_shortcut();
    let mut current = LAUNCHER_SHORTCUT.lock().unwrap();

    if let Some(previous) = current.take() {
        let _ = shortcuts.unregister(previous.as_str());
    }

    let Some(next) = shortcut else {
        return Ok(());
    };

    shortcuts
        .on_shortcut(next.as_str(), |app, _, event| {
            if event.state() == ShortcutState::Pressed {
                windowing::toggle(app, "main");
            }
        })
        .map_err(|e| e.to_string())?;

    *current = Some(next);

    Ok(())
}

#[tauri::command]
fn set_chat_shortcut(app: AppHandle, shortcut: Option<String>) -> Result<(), String> {
    let shortcuts = app.global_shortcut();
    let mut current = CHAT_SHORTCUT.lock().unwrap();

    if let Some(previous) = current.take() {
        let _ = shortcuts.unregister(previous.as_str());
    }

    let Some(next) = shortcut else {
        return Ok(());
    };

    // the panel's open state lives in the page, so ask it to toggle instead of hiding the window
    shortcuts
        .on_shortcut(next.as_str(), |app, _, event| {
            if event.state() == ShortcutState::Pressed && CHAT_ON.load(Ordering::Relaxed) {
                windowing::show(app, "chat");

                let _ = app.emit("chat-toggle", ());
            }
        })
        .map_err(|e| e.to_string())?;

    *current = Some(next);

    Ok(())
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
        .invoke_handler(tauri::generate_handler![
            apps::list_apps,
            apps::pinned_apps,
            apps::launch_app,
            apps::open_location,
            files::list_dir,
            files::file_places,
            files::search_dir,
            files::create_folder,
            files::rename_entry,
            files::delete_entries,
            files::transfer_entries,
            icons::app_icon,
            desktop::list_windows,
            desktop::activate_window,
            desktop::close_window,
            desktop::minimize_window,
            preview::preview_show,
            preview::preview_hide,
            system::system_accent,
            system::system_info,
            system::power_action,
            system::empty_recycle_bin,
            system::open_url,
            system::run_command,
            system::machine_name,
            system::open_data_folder,
            icons::clear_icon_cache,
            audio::set_volume,
            audio::toggle_mute,
            audio::audio_devices,
            audio::set_audio_device,
            appbar::apply_taskbar,
            appbar::extend_taskbar,
            monitors::list_monitors,
            media::media_status,
            media::media_command,
            meters::system_meters,
            spectrum::spectrum_start,
            spectrum::spectrum_stop,
            usage::claude_usage,
            usage::usage_bridge_installed,
            usage::install_usage_bridge,
            notify::notify_icons,
            notify::notify_icon_click,
            notify::notify_icon_promote,
            quick::radios,
            quick::set_radio,
            quick::bluetooth_devices,
            quick::quick_action,
            quick::input_language,
            quick::cycle_input_language,
            winkey::set_win_key_capture,
            set_launcher_shortcut,
            set_chat_shortcut,
            windowing::show_window,
            windowing::hide_window,
            windowing::toggle_window,
            claude::claude_which,
            claude::claude_start,
            claude::claude_send,
            claude::claude_stop,
            claude::claude_sessions,
            claude::claude_transcript,
            set_features,
            edit::edit_mode,
            notices::notices_list,
            notices::notices_unseen,
            notices::notices_seen,
            notices::notices_dismiss,
            notices::notices_open_panel,
            notices::notices_take_intent,
            edit::edit_raise,
            windowing::chat_area,
            windowing::chat_frame,
            clipboard::clipboard_history,
            clipboard::clipboard_copy,
            clipboard::clipboard_paste,
            clipboard::clipboard_remove,
            clipboard::clipboard_pin,
            clipboard::clipboard_clear,
        ])
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
