use std::path::PathBuf;
use std::time::SystemTime;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use windows::core::HSTRING;
use windows::Win32::Foundation::WAIT_OBJECT_0;
use windows::Win32::Storage::FileSystem::{
    FindCloseChangeNotification, FindFirstChangeNotificationW, FindNextChangeNotification,
    FILE_NOTIFY_CHANGE_FILE_NAME, FILE_NOTIFY_CHANGE_LAST_WRITE,
};
use windows::Win32::System::Threading::{WaitForSingleObject, INFINITE};
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

const ERIS_IDS: [&str; 2] = ["com.arixlab.eris.windows", "com.eris.app"];

#[derive(Clone, Serialize)]
pub struct ErisStyle {
    linked: bool,
    profile: Option<Value>,
}

fn store_path<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    let base = app.path().data_dir().ok()?;
    let stores = ERIS_IDS.map(|id| base.join(id).join("settings.json"));

    stores
        .iter()
        .find(|path| path.is_file())
        .or(stores.first())
        .cloned()
}

fn read(path: &PathBuf) -> Option<ErisStyle> {
    let text = std::fs::read_to_string(path).ok()?;
    let store: Value = serde_json::from_str(&text).ok()?;

    Some(ErisStyle {
        linked: true,
        profile: store.get("profile").cloned(),
    })
}

fn stamp(path: &PathBuf) -> Option<SystemTime> {
    std::fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
}

pub mod commands {
    use super::*;

    #[tauri::command(async)]
    pub fn eris_style<R: Runtime>(app: AppHandle<R>) -> ErisStyle {
        store_path(&app)
            .and_then(|path| read(&path))
            .unwrap_or(ErisStyle {
                linked: false,
                profile: None,
            })
    }

    #[tauri::command]
    pub fn system_accent() -> Option<String> {
        let value: u32 = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(r"Software\Microsoft\Windows\DWM")
            .and_then(|key| key.get_value("AccentColor"))
            .ok()?;

        let (red, green, blue) = (value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF);

        Some(format!("#{red:02x}{green:02x}{blue:02x}"))
    }
}

pub fn watch<R: Runtime>(app: AppHandle<R>) {
    let Some(path) = store_path(&app) else {
        return;
    };

    let Some(folder) = path
        .parent()
        .map(|folder| HSTRING::from(folder.as_os_str()))
    else {
        return;
    };

    std::thread::spawn(move || {
        let filter = FILE_NOTIFY_CHANGE_LAST_WRITE | FILE_NOTIFY_CHANGE_FILE_NAME;
        let Ok(change) = (unsafe { FindFirstChangeNotificationW(&folder, false, filter) }) else {
            return;
        };

        let mut seen = stamp(&path);

        while unsafe { WaitForSingleObject(change, INFINITE) } == WAIT_OBJECT_0 {
            let now = stamp(&path);

            if now != seen {
                if let Some(style) = read(&path) {
                    seen = now;

                    let _ = app.emit("eris-style", style);
                }
            }

            if unsafe { FindNextChangeNotification(change) }.is_err() {
                break;
            }
        }

        let _ = unsafe { FindCloseChangeNotification(change) };
    });
}
