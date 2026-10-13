use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

// the page's own store handle can only list every entry, so a collection read filters here
#[tauri::command(async)]
pub fn data_entries(app: AppHandle, prefix: String) -> Result<Vec<Value>, String> {
    let store = app.store("data.json").map_err(|e| e.to_string())?;

    Ok(store
        .entries()
        .into_iter()
        .filter(|(key, _)| key.starts_with(&prefix))
        .map(|(_, value)| value)
        .collect())
}
