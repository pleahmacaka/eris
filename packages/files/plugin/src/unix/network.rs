use serde::Serialize;

use crate::error::{Error, Result};

#[derive(Serialize)]
pub struct NetworkPlace {
    name: String,
    path: String,
}

#[tauri::command]
pub async fn network_places() -> Result<Vec<NetworkPlace>> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn reconnect_drive() -> Result<()> {
    Ok(())
}

#[tauri::command]
pub async fn disconnect_drive() -> Result<()> {
    Err(Error::Unsupported)
}

#[tauri::command]
pub async fn map_network_drive() -> Result<()> {
    Err(Error::Unsupported)
}

#[tauri::command]
pub async fn disconnect_network_drive() -> Result<()> {
    Err(Error::Unsupported)
}

#[tauri::command]
pub async fn add_network_location() -> Result<()> {
    Err(Error::Unsupported)
}
