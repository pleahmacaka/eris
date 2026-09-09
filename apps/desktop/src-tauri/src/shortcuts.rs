use std::sync::atomic::Ordering;
use std::sync::Mutex;

use tauri::{AppHandle, Emitter};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::{features, windowing};

static LAUNCHER_SHORTCUT: Mutex<Option<String>> = Mutex::new(None);
static CHAT_SHORTCUT: Mutex<Option<String>> = Mutex::new(None);

#[tauri::command]
pub fn set_launcher_shortcut(app: AppHandle, shortcut: Option<String>) -> Result<(), String> {
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
pub fn set_chat_shortcut(app: AppHandle, shortcut: Option<String>) -> Result<(), String> {
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
            if event.state() == ShortcutState::Pressed && features::CHAT_ON.load(Ordering::Relaxed)
            {
                windowing::show(app, "chat");

                let _ = app.emit("chat-toggle", ());
            }
        })
        .map_err(|e| e.to_string())?;

    *current = Some(next);

    Ok(())
}
