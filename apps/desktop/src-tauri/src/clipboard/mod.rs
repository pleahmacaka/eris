use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

use crate::shell::features::LAUNCHER_ON;

mod win;

const LIMIT: usize = 200;
const MAX_TEXT: usize = 100_000;
const SAVE_DELAY: Duration = Duration::from_secs(1);

static UNSAVED: AtomicBool = AtomicBool::new(false);
static WRITING: Mutex<()> = Mutex::new(());

#[derive(Clone, Serialize, Deserialize)]
pub struct ClipEntry {
    pub id: String,
    pub text: String,
    pub at: u64,
    pub pinned: bool,
}

// an edit before the saved list is read would persist an empty history over it, so every access loads first
fn history(app: &AppHandle) -> &'static Mutex<Vec<ClipEntry>> {
    static HISTORY: OnceLock<Mutex<Vec<ClipEntry>>> = OnceLock::new();

    HISTORY.get_or_init(|| Mutex::new(load(app)))
}

fn file(app: &AppHandle) -> Option<PathBuf> {
    Some(app.path().app_data_dir().ok()?.join("clipboard.json"))
}

fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_millis() as u64)
        .unwrap_or_default()
}

fn load(app: &AppHandle) -> Vec<ClipEntry> {
    file(app)
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice::<Vec<ClipEntry>>(&bytes).ok())
        .unwrap_or_default()
}

fn persist(app: &AppHandle) {
    if UNSAVED.swap(true, Ordering::Relaxed) {
        return;
    }

    let app = app.clone();

    std::thread::spawn(move || {
        std::thread::sleep(SAVE_DELAY);
        flush(&app);
    });
}

pub fn flush(app: &AppHandle) {
    let _writing = WRITING.lock().unwrap();

    if !UNSAVED.swap(false, Ordering::Relaxed) {
        return;
    }

    let Some(path) = file(app) else {
        return;
    };

    let Ok(bytes) = serde_json::to_vec(&*history(app).lock().unwrap()) else {
        return;
    };

    let staging = path.with_extension("json.tmp");

    let _ = path.parent().map(std::fs::create_dir_all);

    if std::fs::write(&staging, bytes).is_ok() {
        let _ = std::fs::rename(staging, path);
    }
}

fn push(app: &AppHandle, text: String) {
    {
        let mut entries = history(app).lock().unwrap();
        let pinned = entries
            .iter()
            .find(|entry| entry.text == text)
            .is_some_and(|entry| entry.pinned);

        entries.retain(|entry| entry.text != text);
        entries.insert(
            0,
            ClipEntry {
                id: crate::apps::launcher::stable_id(&format!("{}:{text}", now())),
                text,
                at: now(),
                pinned,
            },
        );

        let mut kept = 0;

        entries.retain(|entry| {
            kept += 1;

            entry.pinned || kept <= LIMIT
        });
    }

    persist(app);
}

fn read_text(app: &AppHandle) -> Option<String> {
    let text = app.clipboard().read_text().ok()?;

    (!text.trim().is_empty() && text.len() <= MAX_TEXT).then_some(text)
}

pub fn watch(app: AppHandle) {
    std::thread::spawn(move || {
        history(&app);

        let mut last = win::sequence();

        loop {
            std::thread::sleep(Duration::from_millis(400));

            let current = win::sequence();

            if current == last {
                continue;
            }

            last = current;

            if !LAUNCHER_ON.load(Ordering::Relaxed) || win::excluded() {
                continue;
            }

            if let Some(text) = read_text(&app) {
                push(&app, text);
            }
        }
    });
}

fn find(app: &AppHandle, id: &str) -> Option<ClipEntry> {
    history(app)
        .lock()
        .unwrap()
        .iter()
        .find(|entry| entry.id == id)
        .cloned()
}

#[tauri::command(async)]
pub fn clipboard_history(app: AppHandle) -> Vec<ClipEntry> {
    history(&app).lock().unwrap().clone()
}

#[tauri::command]
pub fn clipboard_copy(app: AppHandle, id: String) -> Result<(), String> {
    let entry = find(&app, &id).ok_or("clipboard entry is gone")?;

    app.clipboard()
        .write_text(entry.text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clipboard_paste(app: AppHandle, id: String) -> Result<(), String> {
    clipboard_copy(app.clone(), id)?;
    crate::shell::windowing::hide(&app, "main");

    std::thread::spawn(|| {
        let deadline = Instant::now() + Duration::from_millis(500);

        while !win::foreign_foreground() && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }

        win::paste();
    });

    Ok(())
}

#[tauri::command]
pub fn clipboard_remove(app: AppHandle, id: String) {
    history(&app).lock().unwrap().retain(|entry| entry.id != id);
    persist(&app);
}

#[tauri::command]
pub fn clipboard_pin(app: AppHandle, id: String, pinned: bool) {
    if let Some(entry) = history(&app)
        .lock()
        .unwrap()
        .iter_mut()
        .find(|entry| entry.id == id)
    {
        entry.pinned = pinned;
    }

    persist(&app);
}

#[tauri::command]
pub fn clipboard_clear(app: AppHandle) {
    history(&app).lock().unwrap().retain(|entry| entry.pinned);
    persist(&app);
}

#[derive(Clone, Serialize)]
pub struct ClipboardFiles {
    pub paths: Vec<String>,
    pub cut: bool,
}

#[tauri::command]
pub fn clipboard_write_files(paths: Vec<String>, cut: bool) -> Result<(), String> {
    win::write_files(&paths, cut)
}

#[tauri::command]
pub fn clipboard_read_files() -> Option<ClipboardFiles> {
    win::read_files()
}

#[tauri::command]
pub fn clipboard_has_files() -> bool {
    win::has_files()
}
