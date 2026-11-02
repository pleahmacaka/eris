use std::path::PathBuf;
use std::sync::{mpsc, Mutex};
use std::time::{Duration, Instant};

use tauri::ipc::Invoke;
use tauri::{AppHandle, Manager, Runtime};

const SLOW: Duration = Duration::from_millis(250);
const PING: Duration = Duration::from_secs(1);
const STALL: Duration = Duration::from_secs(2);

static RUNNING: Mutex<Option<String>> = Mutex::new(None);

pub(crate) fn on_main<T>(label: &str, work: impl FnOnce() -> T) -> T {
    let started = Instant::now();

    *RUNNING.lock().unwrap() = Some(label.to_string());

    let done = work();

    *RUNNING.lock().unwrap() = None;

    let held = started.elapsed();

    if held >= SLOW {
        log::warn!("{label} held the main thread for {} ms", held.as_millis());
    }

    done
}

pub(crate) fn timed<R: Runtime>(
    handler: impl Fn(Invoke<R>) -> bool + Send + Sync + 'static,
) -> impl Fn(Invoke<R>) -> bool + Send + Sync + 'static {
    move |invoke| {
        let command = invoke.message.command().to_string();

        on_main(&command, || handler(invoke))
    }
}

pub(crate) fn watch_main_thread<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(PING);

        let (sender, receiver) = mpsc::channel();
        let sent = Instant::now();

        let answer = move || {
            let _ = sender.send(());
        };

        if app.run_on_main_thread(answer).is_err() {
            return;
        }

        match receiver.recv_timeout(STALL) {
            Ok(()) => continue,
            Err(mpsc::RecvTimeoutError::Disconnected) => return,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
        }

        let running = RUNNING.lock().unwrap().clone();

        log::warn!(
            "main thread unresponsive, running: {}",
            running.as_deref().unwrap_or("no command")
        );

        if receiver.recv().is_err() {
            return;
        }

        log::warn!(
            "main thread answered a ping after {} ms",
            sent.elapsed().as_millis()
        );
    });
}

pub fn log_panics() {
    let report = std::panic::take_hook();

    std::panic::set_hook(Box::new(move |info| {
        let thread = std::thread::current();

        log::error!(
            "panic on thread {}: {info}",
            thread.name().unwrap_or("unnamed")
        );

        report(info);
    }));
}

fn newest_log(dir: PathBuf) -> Option<PathBuf> {
    std::fs::read_dir(dir)
        .ok()?
        .flatten()
        .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "log"))
        .max_by_key(|entry| entry.metadata().and_then(|meta| meta.modified()).ok())
        .map(|entry| entry.path())
}

#[tauri::command(async)]
pub fn log_file(app: AppHandle) -> Option<String> {
    let dir = app.path().app_log_dir().ok()?;

    newest_log(dir).map(|path| path.to_string_lossy().into_owned())
}
