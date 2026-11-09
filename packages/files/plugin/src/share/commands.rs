use std::sync::atomic::Ordering;

use iroh::EndpointId;
use tauri::AppHandle;

use super::browse::{local_dir, received_root, Answer, Browsed, LocalDir, Scope};
use super::node;
use super::peers::Invite;
use super::store::State;
use super::wire::{fail, Reply, Request};
use crate::error::{Error, Result};

#[tauri::command(async)]
pub fn share_state(app: AppHandle) -> Result<State> {
    Ok(node(&app)?.state())
}

#[tauri::command(async)]
pub fn share_take_attention(app: AppHandle) -> Result<bool> {
    Ok(node(&app)?.attention.swap(false, Ordering::Relaxed))
}

#[tauri::command(async)]
pub fn share_rename_self(app: AppHandle, name: String) -> Result<()> {
    let name = name.trim().to_string();

    node(&app)?.update(|saved| saved.name = name)
}

#[tauri::command(async)]
pub async fn share_invite(app: AppHandle) -> Result<Invite> {
    node(&app)?.invite().await
}

#[tauri::command(async)]
pub async fn share_join(app: AppHandle, code: String) -> Result<()> {
    node(&app)?.join(&code).await
}

#[tauri::command(async)]
pub fn share_dismiss_pair(app: AppHandle) -> Result<()> {
    let node = node(&app)?;

    *node.pending_pair.lock().unwrap() = None;
    node.changed();

    Ok(())
}

#[tauri::command(async)]
pub fn share_rename_device(app: AppHandle, id: EndpointId, name: String) -> Result<()> {
    let name = name.trim().to_string();

    node(&app)?.update(|saved| {
        if let Some(device) = saved.devices.iter_mut().find(|device| device.id == id) {
            device.name = name;
        }
    })
}

#[tauri::command(async)]
pub async fn share_remove_device(app: AppHandle, id: EndpointId) -> Result<()> {
    node(&app)?.remove_device(id).await
}

#[tauri::command(async)]
pub fn share_local(path: Option<String>) -> Result<LocalDir> {
    local_dir(path)
}

#[tauri::command(async)]
pub async fn share_browse(
    app: AppHandle,
    device: EndpointId,
    path: Option<String>,
) -> Result<Browsed> {
    Ok(
        match node(&app)?.call(device, Request::Browse { path }).await? {
            Reply::Listing { path, entries } => Browsed::Listing { path, entries },
            Reply::Pending => Browsed::Pending,
            _ => Browsed::Denied,
        },
    )
}

#[tauri::command(async)]
pub async fn share_browse_fetch(
    app: AppHandle,
    device: EndpointId,
    path: String,
) -> Result<Option<String>> {
    let node = node(&app)?;

    match node.call(device, Request::Fetch { path }).await? {
        Reply::Pending => Ok(None),
        Reply::Blob { hash, name, .. } => node
            .save_remote(device, hash, &name, &received_root(&app)?)
            .await
            .map(Some),
        _ => Err(Error::Denied),
    }
}

#[tauri::command(async)]
pub fn share_browse_answer(app: AppHandle, device: EndpointId, answer: Answer) -> Result<()> {
    node(&app)?.answer_browse(device, answer)
}

#[tauri::command(async)]
pub fn share_browse_revoke(app: AppHandle, device: EndpointId) -> Result<()> {
    node(&app)?.revoke_browse(device)
}

#[tauri::command(async)]
pub fn share_browse_scope(app: AppHandle, scope: Scope, folders: Vec<String>) -> Result<()> {
    node(&app)?.browse_scope(scope, folders)
}

#[tauri::command]
pub fn share_qr(text: String) -> Result<String> {
    let code = qrcode::QrCode::new(text.as_bytes()).map_err(fail)?;

    let svg = code
        .render::<qrcode::render::svg::Color>()
        .min_dimensions(192, 192)
        .quiet_zone(true)
        .build();

    Ok(svg[svg.find("<svg").unwrap_or_default()..].to_string())
}
