use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use tauri::{AppHandle, Emitter, WebviewWindow};
use windows::core::HSTRING;
use windows::Win32::Foundation::{CloseHandle, HANDLE, WAIT_OBJECT_0, WAIT_TIMEOUT};
use windows::Win32::Storage::FileSystem::{
    FindCloseChangeNotification, FindFirstChangeNotificationW, FindNextChangeNotification,
    FILE_NOTIFY_CHANGE_ATTRIBUTES, FILE_NOTIFY_CHANGE_DIR_NAME, FILE_NOTIFY_CHANGE_FILE_NAME,
    FILE_NOTIFY_CHANGE_LAST_WRITE, FILE_NOTIFY_CHANGE_SIZE,
};
use windows::Win32::System::Threading::{
    CreateEventW, SetEvent, WaitForMultipleObjects, WaitForSingleObject, INFINITE,
};

pub(crate) struct Stop(HANDLE);

// an event handle may be signalled and waited on from any thread
unsafe impl Send for Stop {}
unsafe impl Sync for Stop {}

impl Stop {
    fn new() -> Arc<Self> {
        Arc::new(Self(
            unsafe { CreateEventW(None, true, false, None) }.unwrap_or_default(),
        ))
    }

    pub(crate) fn set(&self) {
        let _ = unsafe { SetEvent(self.0) };
    }

    fn wait(&self, timeout: Duration) -> bool {
        (unsafe { WaitForSingleObject(self.0, timeout.as_millis() as u32) }) != WAIT_TIMEOUT
    }

    fn changed(&self, handle: HANDLE) -> bool {
        (unsafe { WaitForMultipleObjects(&[handle, self.0], false, INFINITE) }) == WAIT_OBJECT_0
    }
}

impl Drop for Stop {
    fn drop(&mut self) {
        let _ = unsafe { CloseHandle(self.0) };
    }
}

fn watchers() -> &'static Mutex<HashMap<String, Arc<Stop>>> {
    static WATCHERS: OnceLock<Mutex<HashMap<String, Arc<Stop>>>> = OnceLock::new();

    WATCHERS.get_or_init(Default::default)
}

fn spawn(app: AppHandle, label: String, slot: String, path: String, stop: Arc<Stop>) {
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

        while stop.changed(handle) {
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
        previous.set();
    }

    let Some(path) = path else {
        return;
    };

    let stop = Stop::new();

    active.insert(key, stop.clone());
    spawn(app, label, slot, path, stop);
}

pub fn forget(label: &str) {
    let prefix = format!("{label}/");

    watchers().lock().unwrap().retain(|key, stop| {
        let owned = key.starts_with(&prefix);

        if owned {
            stop.set();
        }

        !owned
    });
}

pub(crate) fn watch_tree(
    path: std::path::PathBuf,
    settle: Duration,
    on_change: impl Fn() + Send + 'static,
) -> Arc<Stop> {
    let stop = Stop::new();
    let stopped = stop.clone();

    std::thread::spawn(move || {
        let filter = FILE_NOTIFY_CHANGE_FILE_NAME
            | FILE_NOTIFY_CHANGE_DIR_NAME
            | FILE_NOTIFY_CHANGE_SIZE
            | FILE_NOTIFY_CHANGE_LAST_WRITE;
        let folder = HSTRING::from(path.as_path());
        let quiet = settle.as_millis() as u32;
        let mut missed = false;

        while !stopped.wait(Duration::ZERO) {
            let Ok(handle) = (unsafe { FindFirstChangeNotificationW(&folder, true, filter) })
            else {
                missed = true;

                if stopped.wait(Duration::from_secs(5)) {
                    break;
                }

                continue;
            };

            if missed {
                on_change();
            }

            let mut armed = true;

            while armed && stopped.changed(handle) {
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
