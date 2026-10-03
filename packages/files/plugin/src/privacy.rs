#[tauri::command]
pub async fn screen_sharing() -> bool {
    tauri::async_runtime::spawn_blocking(is_screen_sharing::is_screen_sharing)
        .await
        .unwrap_or(true)
}
