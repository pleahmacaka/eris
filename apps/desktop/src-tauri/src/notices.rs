use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::AppHandle;

use crate::windowing;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Notice {
    pub id: i64,
    pub app: String,
    pub title: String,
    pub body: String,
    pub arrived: u64,
}

static DISMISSED: Mutex<Vec<i64>> = Mutex::new(Vec::new());
static SEEN_AT: Mutex<u64> = Mutex::new(0);
static PANEL_INTENT: AtomicBool = AtomicBool::new(false);

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command(async)]
pub fn notices_list() -> Result<Vec<Notice>, String> {
    let dismissed = DISMISSED.lock().unwrap().clone();

    Ok(win::read()?
        .into_iter()
        .filter(|notice| !dismissed.contains(&notice.id))
        .collect())
}

#[tauri::command(async)]
pub fn notices_unseen() -> Result<usize, String> {
    let seen = *SEEN_AT.lock().unwrap();

    Ok(notices_list()?
        .iter()
        .filter(|notice| notice.arrived > seen)
        .count())
}

#[tauri::command]
pub fn notices_seen() {
    *SEEN_AT.lock().unwrap() = now_ms();
}

#[tauri::command]
pub fn notices_dismiss(ids: Vec<i64>) {
    DISMISSED.lock().unwrap().extend(ids);
}

#[tauri::command]
pub fn notices_open_panel(app: AppHandle) {
    PANEL_INTENT.store(true, Ordering::Relaxed);
    windowing::show(&app, "panel");
}

#[tauri::command]
pub fn notices_take_intent() -> bool {
    PANEL_INTENT.swap(false, Ordering::Relaxed)
}

fn database_copy() -> Result<PathBuf, String> {
    let local = std::env::var_os("LOCALAPPDATA").ok_or("LOCALAPPDATA is not set")?;
    let source = PathBuf::from(local).join("Microsoft/Windows/Notifications/wpndatabase.db");
    let folder = std::env::temp_dir().join("eris-notices");

    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;

    let copy = folder.join("wpndatabase.db");

    std::fs::copy(&source, &copy).map_err(|e| e.to_string())?;

    // the newest toasts live in the WAL until Windows checkpoints, so it must travel with the copy
    let wal = source.with_extension("db-wal");
    let wal_copy = copy.with_extension("db-wal");

    if wal.exists() {
        std::fs::copy(&wal, &wal_copy).map_err(|e| e.to_string())?;
    } else {
        let _ = std::fs::remove_file(&wal_copy);
    }

    Ok(copy)
}

fn filetime_ms(filetime: i64) -> u64 {
    const EPOCH_GAP_MS: i64 = 11_644_473_600_000;

    (filetime / 10_000 - EPOCH_GAP_MS).max(0) as u64
}

fn parse_toast(xml: &str) -> (String, String) {
    let Ok(doc) = roxmltree::Document::parse(xml) else {
        return (String::new(), String::new());
    };

    let mut texts = doc
        .descendants()
        .filter(|node| node.has_tag_name("text"))
        .filter_map(|node| node.text())
        .map(str::trim)
        .filter(|text| !text.is_empty());

    let title = texts.next().unwrap_or_default().to_string();
    let body = texts.collect::<Vec<_>>().join("\n");

    (title, body)
}

#[cfg(target_os = "windows")]
mod win {
    use super::{database_copy, filetime_ms, now_ms, Notice};

    const QUERY: &str = "SELECT n.Id, n.Payload, n.ArrivalTime, n.ExpiryTime, h.PrimaryId \
        FROM Notification n JOIN NotificationHandler h ON n.HandlerId = h.RecordId \
        WHERE n.Type = 'toast' ORDER BY n.ArrivalTime DESC LIMIT 100";

    pub fn read() -> Result<Vec<Notice>, String> {
        let copy = database_copy()?;
        let db = rusqlite::Connection::open(&copy).map_err(|e| e.to_string())?;
        let mut statement = db.prepare(QUERY).map_err(|e| e.to_string())?;
        let now = now_ms();

        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, Vec<u8>>(1)?,
                    row.get::<_, i64>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut notices = Vec::new();

        for row in rows.flatten() {
            let (id, payload, arrival, expiry, app) = row;

            if expiry > 0 && filetime_ms(expiry) < now {
                continue;
            }

            let (title, body) = super::parse_toast(&String::from_utf8_lossy(&payload));

            if title.is_empty() && body.is_empty() {
                continue;
            }

            notices.push(Notice {
                id,
                app,
                title,
                body,
                arrived: filetime_ms(arrival),
            });
        }

        Ok(notices)
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::Notice;

    pub fn read() -> Result<Vec<Notice>, String> {
        Ok(Vec::new())
    }
}

#[cfg(test)]
mod tests {
    use super::{filetime_ms, parse_toast};

    #[test]
    fn toast_text_splits_into_title_and_body() {
        let xml = "<toast><visual><binding template='ToastGeneric'><text>Hello</text><text>World</text><text> </text></binding></visual></toast>";

        assert_eq!(parse_toast(xml), ("Hello".into(), "World".into()));
    }

    #[test]
    fn filetime_epoch_maps_to_zero() {
        assert_eq!(filetime_ms(116_444_736_000_000_000), 0);
    }
}
