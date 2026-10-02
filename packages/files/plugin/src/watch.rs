use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use tauri::{AppHandle, Emitter, WebviewWindow};
use windows::core::HSTRING;
use windows::Win32::Foundation::WAIT_OBJECT_0;
use windows::Win32::Storage::FileSystem::{
    FindCloseChangeNotification, FindFirstChangeNotificationW, FindNextChangeNotification,
    FILE_NOTIFY_CHANGE_ATTRIBUTES, FILE_NOTIFY_CHANGE_DIR_NAME, FILE_NOTIFY_CHANGE_FILE_NAME,
    FILE_NOTIFY_CHANGE_LAST_WRITE, FILE_NOTIFY_CHANGE_SIZE,
};
use windows::Win32::System::Threading::WaitForSingleObject;

fn watchers() -> &'static Mutex<HashMap<String, Arc<AtomicBool>>> {
    static WATCHERS: OnceLock<Mutex<HashMap<String, Arc<AtomicBool>>>> = OnceLock::new();

    WATCHERS.get_or_init(Default::default)
}

fn spawn(app: AppHandle, label: String, slot: String, path: String, stop: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        let filter = FILE_NOTIFY_CHANGE_FILE_NAME
            | FILE_NOTIFY_CHANGE_DIR_NAME
            | FILE_NOTIFY_CHANGE_SIZE
            | FILE_NOTIFY_CHANGE_LAST_WRITE
            | FILE_NOTIFY_CHANGE_ATTRIBUTES;

        let Ok(handle) =
            (unsafe { FindFirstChangeNotificationW(&HSTRING::from(path), false, filter) })
        else {
            return;
        };

        while !stop.load(Ordering::Relaxed) {
            if unsafe { WaitForSingleObject(handle, 400) } != WAIT_OBJECT_0 {
                continue;
            }

            std::thread::sleep(Duration::from_millis(150));

            let _ = app.emit_to(label.as_str(), "dir-changed", &slot);

            if unsafe { FindNextChangeNotification(handle) }.is_err() {
                break;
            }
        }

        let _ = unsafe { FindCloseChangeNotification(handle) };
    });
}

#[tauri::command(async)]
pub fn watch_dir(app: AppHandle, window: WebviewWindow, slot: String, path: Option<String>) {
    let label = window.label().to_string();
    let key = format!("{label}/{slot}");
    let path = path.filter(|path| std::path::Path::new(path).is_dir());
    let mut active = watchers().lock().unwrap();

    if let Some(previous) = active.remove(&key) {
        previous.store(true, Ordering::Relaxed);
    }

    let Some(path) = path else {
        return;
    };

    let stop = Arc::new(AtomicBool::new(false));

    active.insert(key, stop.clone());
    spawn(app, label, slot, path, stop);
}

pub fn forget(label: &str) {
    let prefix = format!("{label}/");

    watchers().lock().unwrap().retain(|key, stop| {
        let owned = key.starts_with(&prefix);

        if owned {
            stop.store(true, Ordering::Relaxed);
        }

        !owned
    });
}

pub(crate) fn watch_tree(
    path: std::path::PathBuf,
    settle: Duration,
    on_change: impl Fn() + Send + 'static,
) -> Arc<AtomicBool> {
    let stop = Arc::new(AtomicBool::new(false));
    let stopped = stop.clone();

    std::thread::spawn(move || {
        let filter = FILE_NOTIFY_CHANGE_FILE_NAME
            | FILE_NOTIFY_CHANGE_DIR_NAME
            | FILE_NOTIFY_CHANGE_SIZE
            | FILE_NOTIFY_CHANGE_LAST_WRITE;
        let folder = HSTRING::from(path.as_path());
        let quiet = settle.as_millis() as u32;
        let mut missed = false;

        while !stopped.load(Ordering::Relaxed) {
            let Ok(handle) = (unsafe { FindFirstChangeNotificationW(&folder, true, filter) })
            else {
                missed = true;
                std::thread::sleep(Duration::from_secs(5));

                continue;
            };

            if missed {
                on_change();
            }

            let mut armed = true;

            while armed && !stopped.load(Ordering::Relaxed) {
                if unsafe { WaitForSingleObject(handle, 400) } != WAIT_OBJECT_0 {
                    continue;
                }

                armed = unsafe { FindNextChangeNotification(handle) }.is_ok();

                while armed && unsafe { WaitForSingleObject(handle, quiet) } == WAIT_OBJECT_0 {
                    armed = unsafe { FindNextChangeNotification(handle) }.is_ok();
                }

                on_change();
            }

            let _ = unsafe { FindCloseChangeNotification(handle) };
            missed = true;
        }
    });

    stop
}
