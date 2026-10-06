use crate::error::{Error, Result};

pub fn execute(_owner: isize, path: &str) -> Result<()> {
    open::that_detached(path).map_err(|error| Error::Os(error.to_string()))
}

#[tauri::command]
pub async fn open_item(item: String) -> Result<Option<String>> {
    if std::path::Path::new(&item).is_dir() {
        return Ok(Some(item));
    }

    execute(0, &item).map(|_| None)
}

#[tauri::command]
pub async fn open_with(path: String) -> Result<()> {
    execute(0, &path)
}

#[tauri::command]
pub async fn show_properties(items: Vec<String>) -> Result<()> {
    let folder = items
        .first()
        .and_then(|item| std::path::Path::new(item).parent())
        .ok_or(Error::Invalid)?;

    execute(0, &folder.to_string_lossy())
}

#[tauri::command]
pub async fn start_drag() -> Result<()> {
    Err(Error::Unsupported)
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub async fn empty_recycle_bin() -> Result<()> {
    tauri::async_runtime::spawn_blocking(|| {
        let items = trash::os_limited::list().map_err(|error| Error::Os(error.to_string()))?;

        trash::os_limited::purge_all(items).map_err(|error| Error::Os(error.to_string()))
    })
    .await?
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub async fn empty_recycle_bin() -> Result<()> {
    Err(Error::Unsupported)
}

#[tauri::command]
pub async fn native_menu() -> Result<Option<String>> {
    Ok(None)
}

#[tauri::command]
pub async fn invoke_verb() -> Result<()> {
    Err(Error::Unsupported)
}
