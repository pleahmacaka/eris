use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::thread::Thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

const POLL: Duration = Duration::from_millis(1_500);

static WATCHING: AtomicBool = AtomicBool::new(false);
static SHARING: AtomicBool = AtomicBool::new(false);
static WATCHER: OnceLock<Thread> = OnceLock::new();

#[tauri::command]
pub fn screen_sharing() -> bool {
    SHARING.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn set_share_watch(enabled: bool) {
    WATCHING.store(enabled, Ordering::Relaxed);

    if let Some(watcher) = WATCHER.get() {
        watcher.unpark();
    }
}

pub fn watch(app: AppHandle) {
    let watcher = std::thread::spawn(move || loop {
        let watching = WATCHING.load(Ordering::Relaxed);
        let now = watching && is_screen_sharing::is_screen_sharing();

        if SHARING.swap(now, Ordering::Relaxed) != now {
            let _ = app.emit("screen-share", now);
        }

        if watching {
            std::thread::sleep(POLL);
        } else {
            std::thread::park();
        }
    });

    let _ = WATCHER.set(watcher.thread().clone());
}
