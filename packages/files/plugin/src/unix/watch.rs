use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::RecvTimeoutError;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, WebviewWindow};

const BURST: Duration = Duration::from_millis(150);
const POLL: Duration = Duration::from_millis(400);

fn watchers() -> &'static Mutex<HashMap<String, RecommendedWatcher>> {
    static WATCHERS: OnceLock<Mutex<HashMap<String, RecommendedWatcher>>> = OnceLock::new();

    WATCHERS.get_or_init(Default::default)
}

fn watcher(
    path: &Path,
    mode: RecursiveMode,
    on_event: impl Fn() + Send + 'static,
) -> Option<RecommendedWatcher> {
    let mut watcher = notify::recommended_watcher(move |event: notify::Result<notify::Event>| {
        if event.is_ok() {
            on_event();
        }
    })
    .ok()?;

    watcher.watch(path, mode).ok()?;

    Some(watcher)
}

#[tauri::command(async)]
pub fn watch_dir(app: AppHandle, window: WebviewWindow, slot: String, path: Option<String>) {
    let label = window.label().to_string();
    let key = format!("{label}/{slot}");
    let mut active = watchers().lock().unwrap();

    active.remove(&key);

    let Some(path) = path.filter(|path| Path::new(path).is_dir()) else {
        return;
    };

    let (sender, receiver) = std::sync::mpsc::channel::<()>();

    let Some(watching) = watcher(Path::new(&path), RecursiveMode::NonRecursive, move || {
        let _ = sender.send(());
    }) else {
        return;
    };

    std::thread::spawn(move || {
        while receiver.recv().is_ok() {
            std::thread::sleep(BURST);

            while receiver.try_recv().is_ok() {}

            let _ = app.emit_to(label.as_str(), "dir-changed", &slot);
        }
    });

    active.insert(key, watching);
}

pub fn forget(label: &str) {
    let prefix = format!("{label}/");

    watchers()
        .lock()
        .unwrap()
        .retain(|key, _| !key.starts_with(&prefix));
}

pub(crate) fn watch_tree(
    path: PathBuf,
    settle: Duration,
    on_change: impl Fn() + Send + 'static,
) -> Arc<AtomicBool> {
    let stop = Arc::new(AtomicBool::new(false));
    let stopped = stop.clone();

    std::thread::spawn(move || {
        let (sender, receiver) = std::sync::mpsc::channel::<()>();

        let Some(_watching) = watcher(&path, RecursiveMode::Recursive, move || {
            let _ = sender.send(());
        }) else {
            return;
        };

        while !stopped.load(Ordering::Relaxed) {
            match receiver.recv_timeout(POLL) {
                Ok(()) => {
                    while receiver.recv_timeout(settle).is_ok() {}

                    if !stopped.load(Ordering::Relaxed) {
                        on_change();
                    }
                }
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    stop
}
