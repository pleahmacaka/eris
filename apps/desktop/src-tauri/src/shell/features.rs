use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

use crate::notifications::tray;
use crate::shell::{appbar, edge, shortcuts, windowing, winkey};

const DOCK: [&str; 2] = ["taskbar", "topbar"];

pub(crate) static DOCK_ON: AtomicBool = AtomicBool::new(true);
pub(crate) static LAUNCHER_ON: AtomicBool = AtomicBool::new(true);
static EDGE_WATCHING: AtomicBool = AtomicBool::new(false);
static SUSPENDED: Mutex<Vec<String>> = Mutex::new(Vec::new());
static UPDATING: AtomicBool = AtomicBool::new(false);
static YIELDED: AtomicBool = AtomicBool::new(false);
static TRANSITION: Mutex<()> = Mutex::new(());

#[derive(Clone, Copy)]
pub(crate) enum Hold {
    Updating,
    Yielded,
}

impl Hold {
    fn flag(self) -> &'static AtomicBool {
        match self {
            Hold::Updating => &UPDATING,
            Hold::Yielded => &YIELDED,
        }
    }
}

pub(crate) fn held() -> bool {
    UPDATING.load(Ordering::Relaxed) || YIELDED.load(Ordering::Relaxed)
}

pub(crate) fn dock_on() -> bool {
    DOCK_ON.load(Ordering::Relaxed) && !held()
}

pub(crate) fn dock_deferred(label: &str) -> bool {
    held() && DOCK.contains(&label)
}

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
    if eris_window_kit::headless() {
        return;
    }

    let handle = app.clone();

    std::thread::spawn(move || {
        let Some(taskbar) = handle.get_webview_window("taskbar") else {
            return;
        };

        let _ = appbar::apply(&taskbar, &appbar::stored_layout(&handle));

        if !EDGE_WATCHING.swap(true, Ordering::Relaxed) {
            edge::watch(handle);
        } else {
            edge::wake();
        }
    });
}

// the top bar is a lazy window that retires once hidden, so the shell rebuilds it whenever the setting wants it
pub(crate) fn sync_topbar(app: &AppHandle) {
    if !appbar::topbar_on(app) || app.get_webview_window("topbar").is_some() {
        return;
    }

    let app = app.clone();

    std::thread::spawn(move || {
        windowing::window_for(&app, "topbar");
    });
}

pub(crate) fn release_shell(app: &AppHandle) {
    if eris_window_kit::headless() {
        return;
    }

    appbar::release_all(app);
    tray::release();
    winkey::release();
}

fn rebind_launcher(app: &AppHandle) {
    if let Err(error) = shortcuts::rebind(app) {
        log::warn!("launcher shortcut: {error}");
    }
}

pub(crate) fn hold(app: &AppHandle, reason: Hold) {
    let _transition = TRANSITION.lock().unwrap();
    let was_held = held();

    reason.flag().store(true, Ordering::Relaxed);

    if was_held || eris_window_kit::headless() {
        return;
    }

    for label in DOCK {
        windowing::hide(app, label);
    }

    release_shell(app);
    winkey::settle();
    rebind_launcher(app);
}

pub(crate) fn release(app: &AppHandle, reason: Hold) {
    let _transition = TRANSITION.lock().unwrap();

    reason.flag().store(false, Ordering::Relaxed);

    if held() || eris_window_kit::headless() {
        return;
    }

    tray::host(app.clone());
    appbar::restore_all(app);

    if DOCK_ON.load(Ordering::Relaxed) {
        windowing::show(app, "taskbar");
        start_dock(app);

        if appbar::topbar_on(app) {
            windowing::show(app, "topbar");
        }
    }

    winkey::settle();
    rebind_launcher(app);
}

// the updater exits the process without RunEvent::Exit, and hides every window before it launches the installer
#[tauri::command(async)]
pub fn suspend_shell(app: AppHandle) {
    *SUSPENDED.lock().unwrap() = app
        .webview_windows()
        .into_iter()
        .filter(|(label, window)| {
            !DOCK.contains(&label.as_str()) && window.is_visible().unwrap_or(false)
        })
        .map(|(label, _)| label)
        .collect();

    crate::clipboard::flush(&app);
    hold(&app, Hold::Updating);
}

#[tauri::command(async)]
pub fn resume_shell(app: AppHandle) {
    let shown = std::mem::take(&mut *SUSPENDED.lock().unwrap());

    for label in shown {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.show();
        }
    }

    release(&app, Hold::Updating);
}

fn dock_enabled(app: &AppHandle, on: bool) {
    if on {
        if !held() {
            windowing::show(app, "taskbar");
            start_dock(app);
        }

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
