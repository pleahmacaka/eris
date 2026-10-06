use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;

use iroh::EndpointId;
use tauri::AppHandle;
use uuid::Uuid;

use super::browse::{Answer, Browsed, Scope};
use super::incoming::{received_files, received_root, LocalEntry};
use super::node;
use super::peers::Invite;
use super::store::{ShareView, State};
use super::sync::{safety, target_folder, Safety};
use super::wire::{self, fail, Reply, Request};
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
pub async fn share_create(
    app: AppHandle,
    paths: Vec<String>,
    expires_at: Option<u64>,
) -> Result<ShareView> {
    let paths = paths.into_iter().map(PathBuf::from).collect();

    node(&app)?.create(paths, expires_at).await
}

#[tauri::command(async)]
pub fn share_set_public(app: AppHandle, id: Uuid, public: bool) -> Result<()> {
    node(&app)?.set_public(id, public)
}

#[tauri::command(async)]
pub async fn share_offer(app: AppHandle, id: Uuid, device: EndpointId) -> Result<()> {
    node(&app)?.offer(id, device).await
}

#[tauri::command(async)]
pub fn share_set_expiry(app: AppHandle, id: Uuid, expires_at: Option<u64>) -> Result<()> {
    node(&app)?.set_expiry(id, expires_at)
}

#[tauri::command(async)]
pub fn share_revoke(app: AppHandle, id: Uuid) -> Result<()> {
    node(&app)?.revoke(id)
}

#[tauri::command(async)]
pub async fn share_open(app: AppHandle, link: String) -> Result<()> {
    let link = wire::parse_link(&link).ok_or(Error::Invalid)?;

    node(&app)?.open(link).await;

    Ok(())
}

#[tauri::command(async)]
pub async fn share_fetch(app: AppHandle, id: Uuid) -> Result<()> {
    node(&app)?.fetch(id).await
}

#[tauri::command(async)]
pub fn share_files(app: AppHandle, sub: Option<String>) -> Result<Vec<LocalEntry>> {
    received_files(&received_root(&app)?, sub)
}

#[tauri::command(async)]
pub fn share_download(app: AppHandle, id: Uuid, folder: Option<String>) -> Result<()> {
    let folder = match folder {
        Some(folder) => PathBuf::from(folder),
        None => received_root(&app)?,
    };

    node(&app)?.download(id, folder)
}

#[tauri::command(async)]
pub fn share_cancel(app: AppHandle, id: Uuid) -> Result<()> {
    node(&app)?.cancel(id);

    Ok(())
}

#[tauri::command(async)]
pub fn share_dismiss(app: AppHandle, id: Uuid) -> Result<()> {
    node(&app)?.dismiss(id)
}

#[tauri::command(async)]
pub async fn share_browse(
    app: AppHandle,
    device: EndpointId,
    path: Option<String>,
) -> Result<Browsed> {
    Ok(match node(&app)?.call(device, Request::Browse { path }).await? {
        Reply::Listing { path, entries } => Browsed::Listing { path, entries },
        Reply::Pending => Browsed::Pending,
        _ => Browsed::Denied,
    })
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

#[tauri::command]
pub fn sync_check(app: AppHandle, folder: String) -> Safety {
    safety(&app, Path::new(&folder))
}

#[tauri::command(async)]
pub async fn sync_create(app: AppHandle, folder: String, device: EndpointId) -> Result<()> {
    let path = target_folder(&app, &folder)?;

    node(&app)?.create_sync(path, device).await
}

#[tauri::command(async)]
pub fn sync_accept(app: AppHandle, id: Uuid, folder: String) -> Result<()> {
    let path = target_folder(&app, &folder)?;

    node(&app)?.accept_sync(id, path)
}

#[tauri::command(async)]
pub fn sync_decline(app: AppHandle, id: Uuid) -> Result<()> {
    node(&app)?.decline_sync(id)
}

#[tauri::command(async)]
pub async fn sync_pause(app: AppHandle, id: Uuid, paused: bool) -> Result<()> {
    node(&app)?.pause_sync(id, paused).await
}

#[tauri::command(async)]
pub fn sync_now(app: AppHandle, id: Uuid) -> Result<()> {
    node(&app)?.nudge(id);

    Ok(())
}

#[tauri::command(async)]
pub async fn sync_remove(app: AppHandle, id: Uuid) -> Result<()> {
    node(&app)?.drop_sync(id).await
}
