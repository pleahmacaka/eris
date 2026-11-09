use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::error::{Error, Result};

static CLIPBOARD: Mutex<Option<(Vec<String>, bool)>> = Mutex::new(None);

fn free_name(parent: &Path, name: &str, folder: bool) -> PathBuf {
    let (stem, extension) = match name.rsplit_once('.') {
        Some((stem, extension)) if !folder && !stem.is_empty() => (stem, format!(".{extension}")),
        _ => (name, String::new()),
    };

    (0..)
        .map(|attempt| match attempt {
            0 => parent.join(name),
            n => parent.join(format!("{stem} ({n}){extension}")),
        })
        .find(|candidate| !candidate.exists())
        .unwrap_or_else(|| parent.join(name))
}

fn copy_tree(from: &Path, to: &Path) -> std::io::Result<()> {
    let meta = std::fs::symlink_metadata(from)?;

    if meta.file_type().is_symlink() {
        return std::os::unix::fs::symlink(std::fs::read_link(from)?, to);
    }

    if !meta.is_dir() {
        std::fs::copy(from, to)?;

        return std::fs::File::options()
            .write(true)
            .open(to)?
            .set_modified(meta.modified()?);
    }

    std::fs::create_dir_all(to)?;

    for entry in std::fs::read_dir(from)? {
        let entry = entry?;

        copy_tree(&entry.path(), &to.join(entry.file_name()))?;
    }

    Ok(())
}

fn remove_tree(path: &Path) -> std::io::Result<()> {
    if std::fs::symlink_metadata(path)?.is_dir() {
        std::fs::remove_dir_all(path)
    } else {
        std::fs::remove_file(path)
    }
}

fn place(item: &Path, target: &Path, cut: bool) -> Result<PathBuf> {
    let name = item.file_name().ok_or(Error::Invalid)?.to_string_lossy();

    if cut && item.parent() == Some(target) {
        return Ok(item.to_path_buf());
    }

    if target.starts_with(item) {
        return Err(Error::Invalid);
    }

    let destination = free_name(target, &name, item.is_dir());

    if cut {
        match std::fs::rename(item, &destination) {
            Ok(()) => return Ok(destination),
            Err(error) if error.kind() != ErrorKind::CrossesDevices => return Err(error.into()),
            Err(_) => {}
        }
    }

    if let Err(error) = copy_tree(item, &destination) {
        let _ = remove_tree(&destination);

        return Err(error.into());
    }

    if cut {
        remove_tree(item)?;
    }

    Ok(destination)
}

fn transfer(items: &[String], target: &str, cut: bool) -> Result<Vec<String>> {
    let target = Path::new(target);
    let mut landed = Vec::new();
    let mut failed = None;

    for item in items {
        match place(Path::new(item), target, cut) {
            Ok(path) => landed.push(path.to_string_lossy().into_owned()),
            Err(error) => failed = failed.or(Some(error)),
        }
    }

    failed.map_or(Ok(landed), Err)
}

fn valid_name(name: &str) -> Result<&str> {
    let name = name.trim();
    let bad = name.is_empty()
        || name == "."
        || name == ".."
        || name.len() > 255
        || name.contains(['/', '\0']);

    if bad {
        Err(Error::Invalid)
    } else {
        Ok(name)
    }
}

fn same_file(a: &Path, b: &Path) -> bool {
    use std::os::unix::fs::MetadataExt;

    match (std::fs::metadata(a), std::fs::metadata(b)) {
        (Ok(a), Ok(b)) => a.dev() == b.dev() && a.ino() == b.ino(),
        _ => false,
    }
}

#[tauri::command]
pub async fn transfer_items(items: Vec<String>, target: String, cut: bool) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || transfer(&items, &target, cut).map(|_| ())).await?
}

#[cfg(not(target_os = "android"))]
pub fn recycle(items: Vec<String>) -> Result<()> {
    trash::delete_all(items).map_err(|error| Error::Os(error.to_string()))
}

#[tauri::command]
pub async fn delete_items(items: Vec<String>, permanent: bool) -> Result<()> {
    if items.is_empty() {
        return Ok(());
    }

    tauri::async_runtime::spawn_blocking(move || {
        // Android has no system trash, so every delete there is permanent
        #[cfg(not(target_os = "android"))]
        if !permanent {
            return recycle(items);
        }

        #[cfg(target_os = "android")]
        let _ = permanent;

        let failed = items
            .iter()
            .filter_map(|item| remove_tree(Path::new(item)).err())
            .next();

        failed.map_or(Ok(()), |error| Err(error.into()))
    })
    .await?
}

#[tauri::command]
pub async fn rename_item(item: String, name: String) -> Result<()> {
    let from = PathBuf::from(&item);
    let to = from
        .parent()
        .ok_or(Error::Invalid)?
        .join(valid_name(&name)?);

    if to == from {
        return Ok(());
    }

    if to.exists() && !same_file(&from, &to) {
        return Err(Error::Busy);
    }

    std::fs::rename(from, to).map_err(Into::into)
}

#[tauri::command]
pub async fn new_folder(parent: String, name: String) -> Result<String> {
    let created = free_name(Path::new(&parent), valid_name(&name)?, true);

    std::fs::create_dir(&created)?;

    Ok(created.to_string_lossy().into_owned())
}

// ponytail: the file clipboard lives inside this app; other file managers neither see nor fill it
#[tauri::command]
pub fn set_clipboard(items: Vec<String>, cut: bool) -> Result<()> {
    *CLIPBOARD.lock().unwrap() = Some((items, cut));

    Ok(())
}

#[tauri::command]
pub fn clipboard_has_files() -> bool {
    CLIPBOARD.lock().unwrap().is_some()
}

#[tauri::command]
pub async fn paste_items(target: String) -> Result<Vec<String>> {
    let Some((items, cut)) = CLIPBOARD.lock().unwrap().clone() else {
        return Ok(Vec::new());
    };

    let landed =
        tauri::async_runtime::spawn_blocking(move || transfer(&items, &target, cut)).await??;

    if cut {
        *CLIPBOARD.lock().unwrap() = None;
    }

    Ok(landed)
}
