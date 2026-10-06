use std::path::{Path, PathBuf};

use serde::Serialize;
use sysinfo::Disks;
use tauri::{AppHandle, Manager};

use crate::error::Result;

const MOUNTS: [&str; 4] = ["/media/", "/mnt/", "/run/media/", "/Volumes/"];

#[derive(Serialize)]
pub struct Known {
    id: &'static str,
    path: String,
}

#[derive(Serialize)]
pub struct Drive {
    path: String,
    label: String,
    kind: &'static str,
    free: u64,
    total: u64,
    remote: String,
    connected: bool,
}

#[derive(Serialize)]
pub struct Distro {
    name: String,
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplorerSettings {
    show_hidden: bool,
    show_extensions: bool,
}

pub fn folders(app: &AppHandle) -> Vec<(&'static str, String)> {
    let path = app.path();

    let found: [(&'static str, tauri::Result<PathBuf>); 7] = [
        ("home", path.home_dir()),
        ("desktop", path.desktop_dir()),
        ("downloads", path.download_dir()),
        ("documents", path.document_dir()),
        ("pictures", path.picture_dir()),
        ("music", path.audio_dir()),
        ("videos", path.video_dir()),
    ];

    found
        .into_iter()
        .filter_map(|(id, folder)| {
            let folder = folder.ok().filter(|folder| folder.is_dir())?;

            Some((id, folder.to_string_lossy().into_owned()))
        })
        .collect()
}

#[tauri::command]
pub async fn known_folders(app: AppHandle) -> Result<Vec<Known>> {
    Ok(folders(&app)
        .into_iter()
        .map(|(id, path)| Known { id, path })
        .collect())
}

fn shown(mount: &Path) -> bool {
    let text = mount.to_string_lossy();

    text == "/" || MOUNTS.iter().any(|prefix| text.starts_with(prefix))
}

fn list_drives() -> Vec<Drive> {
    let disks = Disks::new_with_refreshed_list();

    let mut drives: Vec<Drive> = disks
        .list()
        .iter()
        .filter(|disk| disk.is_removable() || shown(disk.mount_point()))
        .filter(|disk| disk.mount_point().is_dir())
        .map(|disk| {
            let mount = disk.mount_point();

            Drive {
                path: mount.to_string_lossy().into_owned(),
                label: mount
                    .file_name()
                    .map(|name| name.to_string_lossy().into_owned())
                    .unwrap_or_default(),
                kind: if disk.is_removable() {
                    "removable"
                } else {
                    "fixed"
                },
                free: disk.available_space(),
                total: disk.total_space(),
                remote: String::new(),
                connected: true,
            }
        })
        .collect();

    drives.sort_by(|a, b| a.path.cmp(&b.path));
    drives.dedup_by(|a, b| a.path == b.path);

    drives
}

#[tauri::command]
pub async fn drives() -> Result<Vec<Drive>> {
    Ok(tauri::async_runtime::spawn_blocking(list_drives).await?)
}

#[tauri::command]
pub fn wsl_distros() -> Vec<Distro> {
    Vec::new()
}

#[tauri::command]
pub fn explorer_settings() -> ExplorerSettings {
    ExplorerSettings {
        show_hidden: false,
        show_extensions: true,
    }
}
