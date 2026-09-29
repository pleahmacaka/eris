use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, WebviewWindow};

use crate::{apps, windowing};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Notice {
    pub id: i64,
    pub app: String,
    pub title: String,
    pub body: String,
    pub arrived: u64,
    #[serde(skip)]
    pub launch: Option<String>,
}

static DISMISSED: Mutex<Vec<i64>> = Mutex::new(Vec::new());
static SEEN_AT: Mutex<u64> = Mutex::new(0);
const SHOWN: usize = 100;

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
        .take(SHOWN)
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
pub fn notices_seen(app: AppHandle) {
    *SEEN_AT.lock().unwrap() = now_ms();

    let _ = app.emit("notices-changed", ());
}

#[tauri::command]
pub fn notices_dismiss(app: AppHandle, ids: Vec<i64>) {
    DISMISSED.lock().unwrap().extend(ids);

    let _ = app.emit("notices-changed", ());
}

#[tauri::command]
pub fn notices_open_panel(app: AppHandle, window: WebviewWindow, anchor: Option<[f64; 4]>) {
    windowing::set_anchor("notices", &window, anchor);
    windowing::show(&app, "notices");
}

// a foreground toast activates through the sender's COM activator, which only the shell can reach, so reopen the app instead
#[tauri::command(async)]
pub fn notices_activate(app: AppHandle, id: i64) -> Result<(), String> {
    let notice = win::read()?
        .into_iter()
        .find(|notice| notice.id == id)
        .ok_or("notification is gone")?;
    let target = notice
        .launch
        .unwrap_or_else(|| format!("shell:AppsFolder\\{}", notice.app));

    apps::shell_execute("open", &target, None, true)?;
    notices_dismiss(app.clone(), vec![id]);
    windowing::hide(&app, "notices");

    Ok(())
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

fn parse_toast(xml: &str) -> (String, String, Option<String>) {
    let Ok(doc) = roxmltree::Document::parse(xml) else {
        return (String::new(), String::new(), None);
    };

    let toast = doc.root_element();
    let launch = (toast.attribute("activationType") == Some("protocol"))
        .then(|| toast.attribute("launch"))
        .flatten()
        .map(str::to_string);

    let mut texts = doc
        .descendants()
        .filter(|node| node.has_tag_name("text"))
        .filter_map(|node| node.text())
        .map(str::trim)
        .filter(|text| !text.is_empty());

    let title = texts.next().unwrap_or_default().to_string();
    let body = texts.collect::<Vec<_>>().join("\n");

    (title, body, launch)
}

#[cfg(target_os = "windows")]
mod win {
    use std::sync::{Mutex, PoisonError};

    use diesel::prelude::*;
    use diesel::sqlite::SqliteConnection;

    use super::{database_copy, filetime_ms, now_ms, Notice};

    static DATABASE: Mutex<()> = Mutex::new(());

    const SCAN: i64 = 500;

    diesel::table! {
        #[sql_name = "Notification"]
        notification (id) {
            #[sql_name = "Id"]
            id -> BigInt,
            #[sql_name = "HandlerId"]
            handler_id -> Nullable<BigInt>,
            #[sql_name = "Type"]
            kind -> Text,
            #[sql_name = "Payload"]
            payload -> Nullable<Binary>,
            #[sql_name = "ArrivalTime"]
            arrival_time -> Nullable<BigInt>,
            #[sql_name = "ExpiryTime"]
            expiry_time -> Nullable<BigInt>,
        }
    }

    diesel::table! {
        #[sql_name = "NotificationHandler"]
        notification_handler (record_id) {
            #[sql_name = "RecordId"]
            record_id -> BigInt,
            #[sql_name = "PrimaryId"]
            primary_id -> Text,
        }
    }

    diesel::allow_tables_to_appear_in_same_query!(notification, notification_handler);

    type Row = (i64, Option<Vec<u8>>, Option<i64>, Option<i64>, String);

    pub fn read() -> Result<Vec<Notice>, String> {
        let _copy_in_use = DATABASE.lock().unwrap_or_else(PoisonError::into_inner);
        let copy = database_copy()?;
        let mut connection =
            SqliteConnection::establish(&copy.to_string_lossy()).map_err(|e| e.to_string())?;
        let now = now_ms();

        let rows: Vec<Row> = notification::table
            .inner_join(
                notification_handler::table
                    .on(notification::handler_id.eq(notification_handler::record_id.nullable())),
            )
            .filter(notification::kind.eq("toast"))
            .order(notification::arrival_time.desc())
            .limit(SCAN)
            .select((
                notification::id,
                notification::payload,
                notification::arrival_time,
                notification::expiry_time,
                notification_handler::primary_id,
            ))
            .load(&mut connection)
            .map_err(|e| e.to_string())?;

        let mut notices = Vec::new();

        for (id, payload, arrival, expiry, app) in rows {
            let (Some(payload), Some(arrival)) = (payload, arrival) else {
                continue;
            };

            if expiry.is_some_and(|expiry| expiry > 0 && filetime_ms(expiry) < now) {
                continue;
            }

            let (title, body, launch) = super::parse_toast(&String::from_utf8_lossy(&payload));

            if title.is_empty() && body.is_empty() {
                continue;
            }

            notices.push(Notice {
                id,
                app,
                title,
                body,
                arrived: filetime_ms(arrival),
                launch,
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

        assert_eq!(parse_toast(xml), ("Hello".into(), "World".into(), None));
    }

    #[test]
    fn only_protocol_toasts_carry_a_launch_target() {
        let protocol = "<toast activationType='protocol' launch='discord://channels/1'><visual><binding><text>Hi</text></binding></visual></toast>";
        let foreground = "<toast launch='action=open'><visual><binding><text>Hi</text></binding></visual></toast>";

        assert_eq!(
            parse_toast(protocol).2.as_deref(),
            Some("discord://channels/1")
        );
        assert_eq!(parse_toast(foreground).2, None);
    }

    #[test]
    fn filetime_epoch_maps_to_zero() {
        assert_eq!(filetime_ms(116_444_736_000_000_000), 0);
    }
}
