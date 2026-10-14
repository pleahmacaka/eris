use std::fs::Metadata;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::error::Result;
use crate::listing::{extension, type_name};

#[derive(Serialize)]
pub struct Stat {
    path: String,
    name: String,
    dir: bool,
    size: u64,
    modified: u64,
    created: u64,
    accessed: u64,
    attrs: u32,
    link: bool,
    readonly: bool,
    kind: String,
}

fn millis(time: std::io::Result<SystemTime>) -> u64 {
    time.ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or_default()
}

#[cfg(windows)]
fn attributes(meta: &Metadata) -> u32 {
    std::os::windows::fs::MetadataExt::file_attributes(meta)
}

#[cfg(not(windows))]
fn attributes(_meta: &Metadata) -> u32 {
    0
}

fn stat(path: String) -> Option<Stat> {
    let own = std::fs::symlink_metadata(&path).ok()?;
    let link = own.file_type().is_symlink();
    let meta = if link {
        std::fs::metadata(&path).unwrap_or(own)
    } else {
        own
    };
    let name = Path::new(&path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.clone());
    let dir = meta.is_dir();

    Some(Stat {
        kind: type_name(&extension(&name), dir),
        size: if dir { 0 } else { meta.len() },
        modified: millis(meta.modified()),
        created: millis(meta.created()),
        accessed: millis(meta.accessed()),
        attrs: attributes(&meta),
        readonly: meta.permissions().readonly(),
        path,
        name,
        dir,
        link,
    })
}

fn stat_all(paths: Vec<String>) -> Vec<Stat> {
    paths.into_iter().filter_map(stat).collect()
}

#[cfg(windows)]
#[tauri::command]
pub async fn stat_items(paths: Vec<String>) -> Result<Vec<Stat>> {
    crate::com::sta(move || stat_all(paths)).await
}

#[cfg(not(windows))]
#[tauri::command]
pub async fn stat_items(paths: Vec<String>) -> Result<Vec<Stat>> {
    Ok(tauri::async_runtime::spawn_blocking(move || stat_all(paths)).await?)
}
