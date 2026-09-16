use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

const LIMIT: usize = 200;
const MAX_TEXT: usize = 100_000;

#[derive(Clone, Serialize, Deserialize)]
pub struct ClipEntry {
    pub id: String,
    pub text: String,
    pub at: u64,
    pub pinned: bool,
}

fn history() -> &'static Mutex<Vec<ClipEntry>> {
    static HISTORY: OnceLock<Mutex<Vec<ClipEntry>>> = OnceLock::new();

    HISTORY.get_or_init(Default::default)
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

fn load(app: &AppHandle) {
    let Some(saved) = file(app)
        .and_then(|path| std::fs::read(path).ok())
        .and_then(|bytes| serde_json::from_slice::<Vec<ClipEntry>>(&bytes).ok())
    else {
        return;
    };

    *history().lock().unwrap() = saved;
}

fn persist(app: &AppHandle) {
    let Some(path) = file(app) else {
        return;
    };

    let entries = history().lock().unwrap();

    let Ok(bytes) = serde_json::to_vec(&*entries) else {
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
        let mut entries = history().lock().unwrap();
        let pinned = entries
            .iter()
            .find(|entry| entry.text == text)
            .is_some_and(|entry| entry.pinned);

        entries.retain(|entry| entry.text != text);
        entries.insert(
            0,
            ClipEntry {
                id: crate::apps::stable_id(&format!("{}:{text}", now())),
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
    load(&app);

    std::thread::spawn(move || {
        let mut last = win::sequence();

        loop {
            std::thread::sleep(Duration::from_millis(400));

            let current = win::sequence();

            if current == last {
                continue;
            }

            last = current;

            if win::excluded() {
                continue;
            }

            if let Some(text) = read_text(&app) {
                push(&app, text);
            }
        }
    });
}

fn find(id: &str) -> Option<ClipEntry> {
    history()
        .lock()
        .unwrap()
        .iter()
        .find(|entry| entry.id == id)
        .cloned()
}

#[tauri::command]
pub fn clipboard_history() -> Vec<ClipEntry> {
    history().lock().unwrap().clone()
}

#[tauri::command]
pub fn clipboard_copy(app: AppHandle, id: String) -> Result<(), String> {
    let entry = find(&id).ok_or("clipboard entry is gone")?;

    app.clipboard()
        .write_text(entry.text)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clipboard_paste(app: AppHandle, id: String) -> Result<(), String> {
    clipboard_copy(app.clone(), id)?;
    crate::windowing::hide(&app, "main");

    std::thread::spawn(|| {
        std::thread::sleep(Duration::from_millis(150));
        win::paste();
    });

    Ok(())
}

#[tauri::command]
pub fn clipboard_remove(app: AppHandle, id: String) {
    history().lock().unwrap().retain(|entry| entry.id != id);
    persist(&app);
}

#[tauri::command]
pub fn clipboard_pin(app: AppHandle, id: String, pinned: bool) {
    if let Some(entry) = history()
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
    history().lock().unwrap().retain(|entry| entry.pinned);
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

#[cfg(target_os = "windows")]
mod win {
    use windows::core::w;
    use windows::Win32::Foundation::{HGLOBAL, HANDLE, POINT};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, GetClipboardData, GetClipboardSequenceNumber,
        IsClipboardFormatAvailable, OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows::Win32::System::Memory::{
        GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{VK_CONTROL, VK_V};
    use windows::Win32::UI::Shell::{DragQueryFileW, DROPFILES, HDROP};

    use super::ClipboardFiles;

    pub fn sequence() -> u32 {
        unsafe { GetClipboardSequenceNumber() }
    }

    pub fn excluded() -> bool {
        unsafe {
            let monitor =
                RegisterClipboardFormatW(w!("ExcludeClipboardContentFromMonitorProcessing"));
            let history = RegisterClipboardFormatW(w!("CanIncludeInClipboardHistory"));

            if IsClipboardFormatAvailable(monitor).is_ok() {
                return true;
            }

            if IsClipboardFormatAvailable(history).is_err() {
                return false;
            }

            history_flag(history).map_or(true, |flag| flag == 0)
        }
    }

    unsafe fn history_flag(format: u32) -> Option<u32> {
        unsafe { OpenClipboard(None) }.ok()?;

        let flag = unsafe { GetClipboardData(format) }.ok().and_then(|handle| {
            let memory = HGLOBAL(handle.0);
            let data = unsafe { GlobalLock(memory) } as *const u32;

            let value = (!data.is_null() && unsafe { GlobalSize(memory) } >= 4)
                .then(|| unsafe { data.read_unaligned() });

            let _ = unsafe { GlobalUnlock(memory) };

            value
        });

        let _ = unsafe { CloseClipboard() };

        flag
    }

    pub fn paste() {
        crate::winkey::chord(&[VK_CONTROL, VK_V]);
    }

    const CF_HDROP: u32 = 15;

    fn drop_effect() -> u32 {
        unsafe { RegisterClipboardFormatW(w!("Preferred DropEffect")) }
    }

    pub fn write_files(paths: &[String], cut: bool) -> Result<(), String> {
        unsafe {
            OpenClipboard(None).map_err(|e| e.to_string())?;

            let result = (|| -> Result<(), String> {
                EmptyClipboard().map_err(|e| e.to_string())?;

                let mut wide: Vec<u16> = Vec::new();

                for path in paths {
                    wide.extend(path.encode_utf16());
                    wide.push(0);
                }

                wide.push(0);

                let bytes = std::mem::size_of::<DROPFILES>() + wide.len() * 2;
                let list = GlobalAlloc(GMEM_MOVEABLE, bytes).map_err(|e| e.to_string())?;
                let head = GlobalLock(list) as *mut DROPFILES;

                if head.is_null() {
                    return Err("GlobalLock failed".into());
                }

                (*head).pFiles = std::mem::size_of::<DROPFILES>() as u32;
                (*head).pt = POINT { x: 0, y: 0 };
                (*head).fNC = false.into();
                (*head).fWide = true.into();

                std::ptr::copy_nonoverlapping(
                    wide.as_ptr(),
                    head.add(1) as *mut u16,
                    wide.len(),
                );

                let _ = GlobalUnlock(list);

                SetClipboardData(CF_HDROP, Some(HANDLE(list.0)))
                    .map_err(|e| e.to_string())?;

                let effect = GlobalAlloc(GMEM_MOVEABLE, 4).map_err(|e| e.to_string())?;
                let slot = GlobalLock(effect) as *mut u32;

                if slot.is_null() {
                    return Err("GlobalLock failed".into());
                }

                *slot = if cut { 2 } else { 1 };

                let _ = GlobalUnlock(effect);

                SetClipboardData(drop_effect(), Some(HANDLE(effect.0)))
                    .map_err(|e| e.to_string())?;

                Ok(())
            })();

            let _ = CloseClipboard();

            result
        }
    }

    pub fn read_files() -> Option<ClipboardFiles> {
        unsafe {
            OpenClipboard(None).ok()?;

            let result = (|| {
                let handle = GetClipboardData(CF_HDROP).ok()?;
                let drop = HDROP(handle.0);
                let count = DragQueryFileW(drop, u32::MAX, None);
                let mut paths = Vec::with_capacity(count as usize);

                for index in 0..count {
                    let len = DragQueryFileW(drop, index, None) as usize;
                    let mut buffer = vec![0u16; len + 1];

                    DragQueryFileW(drop, index, Some(&mut buffer));
                    paths.push(String::from_utf16_lossy(&buffer[..len]));
                }

                let cut = GetClipboardData(drop_effect())
                    .ok()
                    .and_then(|handle| {
                        let memory = HGLOBAL(handle.0);
                        let data = GlobalLock(memory) as *const u32;
                        let value = (!data.is_null()).then(|| data.read_unaligned());
                        let _ = GlobalUnlock(memory);
                        value
                    })
                    .is_some_and(|effect| effect & 2 == 2);

                Some(ClipboardFiles { paths, cut })
            })();

            let _ = CloseClipboard();

            result
        }
    }

    pub fn has_files() -> bool {
        unsafe { IsClipboardFormatAvailable(CF_HDROP).is_ok() }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::ClipboardFiles;

    pub fn sequence() -> u32 {
        0
    }

    pub fn excluded() -> bool {
        false
    }

    pub fn paste() {}

    pub fn write_files(_paths: &[String], _cut: bool) -> Result<(), String> {
        Err("file clipboard is not supported on this platform".into())
    }

    pub fn read_files() -> Option<ClipboardFiles> {
        None
    }

    pub fn has_files() -> bool {
        false
    }
}
