use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

use crate::{appbar, edge, windowing};

pub(crate) static DOCK_ON: AtomicBool = AtomicBool::new(true);
pub(crate) static LAUNCHER_ON: AtomicBool = AtomicBool::new(true);
pub(crate) static CHAT_ON: AtomicBool = AtomicBool::new(true);
static EDGE_WATCHING: AtomicBool = AtomicBool::new(false);

#[derive(serde::Deserialize)]
pub struct Features {
    pub(crate) dock: bool,
    pub(crate) launcher: bool,
    pub(crate) chat: bool,
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
        chat: flag("chat"),
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
pub fn set_features(app: AppHandle, features: Features) {
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
