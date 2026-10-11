//! Commands stay below the crate root to avoid Tauri's exported macro namespace.

use tauri::AppHandle;

use super::protocol::{parse_code, Status, MAX_FRAME};
use super::runtime::node;

#[tauri::command(async)]
pub fn p2p_status(app: AppHandle) -> Result<Status, String> {
    Ok(node(&app)?.status())
}

#[tauri::command(async)]
pub async fn p2p_invite(app: AppHandle, name: String) -> Result<String, String> {
    node(&app)?.invite(name).await
}

#[tauri::command(async)]
pub async fn p2p_join(app: AppHandle, code: String, name: String) -> Result<(), String> {
    let (inviter, chain) = parse_code(&code)?;

    node(&app)?.join(inviter.into(), chain, name).await
}

#[tauri::command(async)]
pub fn p2p_leave(app: AppHandle) -> Result<(), String> {
    node(&app)?.leave();

    Ok(())
}

#[tauri::command(async)]
pub fn p2p_publish(app: AppHandle, snapshot: String) -> Result<(), String> {
    if snapshot.len() > MAX_FRAME {
        return Err("snapshot too large".into());
    }

    node(&app)?.publish(snapshot);

    Ok(())
}

#[tauri::command(async)]
pub async fn p2p_sync(app: AppHandle) -> Result<usize, String> {
    node(&app)?.sync().await
}

#[tauri::command(async)]
pub async fn p2p_remove(app: AppHandle, node_id: String) -> Result<(), String> {
    let node = node(&app)?;

    node.remove(node_id)?;
    node.sync().await.map(|_| ())
}
