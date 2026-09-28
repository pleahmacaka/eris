use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

use crate::{appbar, edge, notify, windowing, winkey};

pub(crate) static DOCK_ON: AtomicBool = AtomicBool::new(true);
pub(crate) static LAUNCHER_ON: AtomicBool = AtomicBool::new(true);
static EDGE_WATCHING: AtomicBool = AtomicBool::new(false);
static SUSPENDED: Mutex<Vec<String>> = Mutex::new(Vec::new());

#[derive(serde::Deserialize)]
pub struct Features {
    pub(crate) dock: bool,
    pub(crate) launcher: bool,
}

pub(crate) fn stored_features(app: &AppHandle) -> Features {
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
    }
}

// the shell answers an appbar message by sending one back to the dock, so never ask from its own thread
pub(crate) fn start_dock(app: &AppHandle) {
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

pub(crate) fn release_shell(app: &AppHandle) {
    appbar::release_all(app);
    notify::release();
    winkey::release();
}

// the updater exits the process without RunEvent::Exit, and hides every window before it launches the installer
#[tauri::command(async)]
pub fn suspend_shell(app: AppHandle) {
    *SUSPENDED.lock().unwrap() = app
        .webview_windows()
        .into_iter()
        .filter(|(_, window)| window.is_visible().unwrap_or(false))
        .map(|(label, _)| label)
        .collect();

    release_shell(&app);
}

#[tauri::command(async)]
pub fn resume_shell(app: AppHandle) {
    let shown = std::mem::take(&mut *SUSPENDED.lock().unwrap());

    for label in shown {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.show();
        }
    }

    notify::host(app.clone());
    appbar::restore_all(&app);
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

    if let Some(topbar) = app.get_webview_window("topbar") {
        appbar::release(&topbar);
    }

    windowing::hide(app, "taskbar");
    windowing::hide(app, "topbar");
}

#[tauri::command]
pub fn set_features(app: AppHandle, features: Features) {
    let dock_was = DOCK_ON.swap(features.dock, Ordering::Relaxed);

    LAUNCHER_ON.store(features.launcher, Ordering::Relaxed);

    if dock_was != features.dock {
        dock_enabled(&app, features.dock);
    }

    if !features.launcher {
        windowing::hide(&app, "main");
    }
}
