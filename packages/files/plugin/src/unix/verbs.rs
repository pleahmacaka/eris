use serde::Serialize;

use crate::error::{Error, Result};

#[derive(Serialize)]
pub struct ShellVerb;

#[tauri::command]
pub async fn shell_verbs() -> Result<Vec<ShellVerb>> {
    Ok(Vec::new())
}

#[tauri::command]
pub async fn run_shell_verb() -> Result<()> {
    Err(Error::Unsupported)
}
