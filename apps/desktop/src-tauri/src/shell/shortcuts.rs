use std::sync::atomic::Ordering;
use std::sync::mpsc::channel;
use std::sync::Mutex;

use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::shell::{features, windowing};

static LAUNCHER_SHORTCUT: Mutex<Option<Shortcut>> = Mutex::new(None);
static REQUESTED: Mutex<Option<String>> = Mutex::new(None);

fn bind(app: &AppHandle) -> Result<(), String> {
    let wanted = if features::held() {
        None
    } else {
        REQUESTED.lock().unwrap().clone()
    };
    let next = wanted
        .map(|combo| combo.parse::<Shortcut>())
        .transpose()
        .map_err(|e| e.to_string())?;

    let shortcuts = app.global_shortcut();
    let mut current = LAUNCHER_SHORTCUT.lock().unwrap();

    if next == *current {
        return Ok(());
    }

    if let Some(next) = next {
        shortcuts
            .on_shortcut(next, |app, _, event| {
                if event.state() == ShortcutState::Pressed
                    && features::LAUNCHER_ON.load(Ordering::Relaxed)
                {
                    windowing::toggle(app, "main");
                }
            })
            .map_err(|e| e.to_string())?;
    }

    if let Some(previous) = current.take() {
        let _ = shortcuts.unregister(previous);
    }

    *current = next;

    Ok(())
}

// the global shortcut plugin blocks on the main thread, so binding anywhere else can deadlock against it
pub(crate) fn rebind(app: &AppHandle) -> Result<(), String> {
    let (done, bound) = channel();
    let handle = app.clone();

    app.run_on_main_thread(move || {
        let _ = done.send(bind(&handle));
    })
    .map_err(|e| e.to_string())?;

    bound.recv().map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn set_launcher_shortcut(app: AppHandle, shortcut: Option<String>) -> Result<(), String> {
    if eris_window_kit::headless() {
        return Ok(());
    }

    if let Some(combo) = &shortcut {
        combo.parse::<Shortcut>().map_err(|e| e.to_string())?;
    }

    *REQUESTED.lock().unwrap() = shortcut;

    rebind(&app)
}
