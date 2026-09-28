use std::sync::atomic::Ordering;
use std::sync::Mutex;

use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutEvent, ShortcutState};

use crate::{features, windowing};

static LAUNCHER_SHORTCUT: Mutex<Option<Shortcut>> = Mutex::new(None);

fn replace(
    app: &AppHandle,
    slot: &Mutex<Option<Shortcut>>,
    shortcut: Option<String>,
    handler: impl Fn(&AppHandle, &Shortcut, ShortcutEvent) + Send + Sync + 'static,
) -> Result<(), String> {
    let next = shortcut
        .map(|combo| combo.parse::<Shortcut>())
        .transpose()
        .map_err(|e| e.to_string())?;

    let shortcuts = app.global_shortcut();
    let mut current = slot.lock().unwrap();

    if next == *current {
        return Ok(());
    }

    if let Some(next) = next {
        shortcuts
            .on_shortcut(next, handler)
            .map_err(|e| e.to_string())?;
    }

    if let Some(previous) = current.take() {
        let _ = shortcuts.unregister(previous);
    }

    *current = next;

    Ok(())
}

#[tauri::command]
pub fn set_launcher_shortcut(app: AppHandle, shortcut: Option<String>) -> Result<(), String> {
    replace(&app, &LAUNCHER_SHORTCUT, shortcut, |app, _, event| {
        if event.state() == ShortcutState::Pressed && features::LAUNCHER_ON.load(Ordering::Relaxed)
        {
            windowing::toggle(app, "main");
        }
    })
}
