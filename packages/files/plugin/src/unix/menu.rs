use serde::Deserialize;
use tauri::AppHandle;

use crate::error::{Error, Result};

pub const LABEL: &str = "files-menu";

#[derive(Deserialize)]
pub struct Placement {}

#[tauri::command]
pub async fn menu_prepare() -> Result<bool> {
    Ok(false)
}

#[tauri::command]
pub fn menu_ready() {}

#[tauri::command]
pub async fn menu_place(_placement: Placement) -> Result<()> {
    Err(Error::Unsupported)
}

#[tauri::command]
pub fn menu_hide() {}

pub fn release(_app: &AppHandle, _closing: &str) {}
