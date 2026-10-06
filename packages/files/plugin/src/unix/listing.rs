use std::collections::{HashMap, HashSet, VecDeque};
use std::fs::Metadata;
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, UNIX_EPOCH};

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::AppHandle;
use wildmatch::WildMatch;

use crate::error::{Error, Result};
use crate::places;

const SEARCH_LIMIT: usize = 20_000;
const READONLY: u32 = 0x1;
const HIDDEN: u32 = 0x2;
const DIRECTORY: u32 = 0x10;

pub const HOME: &str = "::{F874310E-B6B7-47DC-BC84-B9E6B38F5903}";
pub const RECYCLE_BIN: &str = "::{645FF040-5081-101B-9F08-00AA002F954E}";

#[derive(Serialize)]
pub struct Entry {
    name: String,
    dir: bool,
    size: u64,
    modified: u64,
    attrs: u32,
    link: bool,
}

#[derive(Serialize)]
pub struct Listing {
    path: String,
    entries: Vec<Entry>,
    types: HashMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Hit {
    name: String,
    parent: String,
    dir: bool,
    size: u64,
    modified: u64,
    attrs: u32,
    link: bool,
    kind: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShellEntry {
    key: String,
    path: String,
    name: String,
    dir: bool,
    size: u64,
    modified: u64,
    kind: String,
}

#[derive(Serialize)]
pub struct ShellListing {
    path: String,
    name: String,
    entries: Vec<ShellEntry>,
}

pub fn extension(name: &str) -> String {
    name.rfind('.')
        .map(|at| name[at..].to_lowercase())
        .unwrap_or_default()
}

pub fn type_name(extension: &str, dir: bool) -> String {
    if dir {
        return "Folder".into();
    }

    match extension.strip_prefix('.') {
        Some(ext) if !ext.is_empty() => format!("{} File", ext.to_uppercase()),
        _ => "File".into(),
    }
}

pub fn millis(meta: &Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |since| since.as_millis() as u64)
}

fn entry(name: String, meta: &Metadata, link: bool) -> Entry {
    let dir = meta.is_dir();
    let mut attrs = 0;

    if dir {
        attrs |= DIRECTORY;
    }

    if name.starts_with('.') {
        attrs |= HIDDEN;
    }

    if meta.permissions().readonly() {
        attrs |= READONLY;
    }

    Entry {
        size: if dir { 0 } else { meta.len() },
        modified: millis(meta),
        name,
        dir,
        attrs,
        link,
    }
}

fn scan(dir: &str, mut visit: impl FnMut(Entry)) -> Result<()> {
    for item in std::fs::read_dir(dir)?.flatten() {
        let Ok(kind) = item.file_type() else {
            continue;
        };

        let link = kind.is_symlink();

        let meta = if link {
            std::fs::metadata(item.path()).or_else(|_| item.metadata())
        } else {
            item.metadata()
        };

        if let Ok(meta) = meta {
            visit(entry(
                item.file_name().to_string_lossy().into_owned(),
                &meta,
                link,
            ));
        }
    }

    Ok(())
}

fn child(dir: &str, name: &str) -> String {
    Path::new(dir).join(name).to_string_lossy().into_owned()
}

fn list(path: String) -> Result<Listing> {
    let mut entries = Vec::new();

    scan(&path, |item| entries.push(item))?;

    let mut types = HashMap::new();

    types.insert("/".to_string(), type_name("", true));

    for item in entries.iter().filter(|item| !item.dir) {
        types
            .entry(extension(&item.name))
            .or_insert_with_key(|ext| type_name(ext, false));
    }

    Ok(Listing {
        path,
        entries,
        types,
    })
}

#[tauri::command]
pub async fn list_dir(path: String) -> Result<Listing> {
    tauri::async_runtime::spawn_blocking(move || list(path)).await?
}

fn live() -> &'static Mutex<HashSet<u32>> {
    static LIVE: OnceLock<Mutex<HashSet<u32>>> = OnceLock::new();

    LIVE.get_or_init(Default::default)
}

#[tauri::command]
pub fn cancel_search(token: u32) {
    live().lock().unwrap().remove(&token);
}

fn search(root: String, query: String, token: u32, batch: Channel<Vec<Hit>>) {
    let needle = query.trim().to_lowercase();

    if needle.is_empty() {
        return;
    }

    let wild = needle.contains(['*', '?']).then(|| WildMatch::new(&needle));
    let matches = |name: &str| {
        let name = name.to_lowercase();

        match &wild {
            Some(pattern) => pattern.matches(&name),
            None => name.contains(&needle),
        }
    };

    live().lock().unwrap().insert(token);

    let mut queue = VecDeque::from([root]);
    let mut pending: Vec<Hit> = Vec::new();
    let mut found = 0;
    let mut sent = Instant::now();

    while let Some(dir) = queue.pop_front() {
        if !live().lock().unwrap().contains(&token) || found >= SEARCH_LIMIT {
            break;
        }

        let _ = scan(&dir, |item| {
            if item.dir && !item.link {
                queue.push_back(child(&dir, &item.name));
            }

            if found < SEARCH_LIMIT && matches(&item.name) {
                found += 1;

                pending.push(Hit {
                    kind: type_name(&extension(&item.name), item.dir),
                    parent: dir.clone(),
                    name: item.name,
                    dir: item.dir,
                    size: item.size,
                    modified: item.modified,
                    attrs: item.attrs,
                    link: item.link,
                });
            }
        });

        if !pending.is_empty()
            && (pending.len() >= 256 || sent.elapsed() > Duration::from_millis(120))
        {
            let _ = batch.send(std::mem::take(&mut pending));
            sent = Instant::now();
        }
    }

    if !pending.is_empty() {
        let _ = batch.send(pending);
    }

    live().lock().unwrap().remove(&token);
}

fn measure(roots: Vec<String>, token: u32) -> Option<u64> {
    let mut queue = VecDeque::from(roots);
    let mut total = 0;

    while let Some(dir) = queue.pop_front() {
        if !live().lock().unwrap().contains(&token) {
            return None;
        }

        let _ = scan(&dir, |item| {
            if !item.dir {
                total += item.size;
            } else if !item.link {
                queue.push_back(child(&dir, &item.name));
            }
        });
    }

    live().lock().unwrap().remove(&token);

    Some(total)
}

#[tauri::command]
pub async fn measure_dirs(paths: Vec<String>, token: u32) -> Result<Option<u64>> {
    live().lock().unwrap().insert(token);

    Ok(tauri::async_runtime::spawn_blocking(move || measure(paths, token)).await?)
}

#[tauri::command]
pub async fn search_dir(
    root: String,
    query: String,
    token: u32,
    batch: Channel<Vec<Hit>>,
) -> Result<()> {
    Ok(tauri::async_runtime::spawn_blocking(move || search(root, query, token, batch)).await?)
}

fn folder_entry(path: String) -> ShellEntry {
    let modified = std::fs::metadata(&path)
        .map(|meta| millis(&meta))
        .unwrap_or_default();
    let name = Path::new(&path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.clone());

    ShellEntry {
        key: path.clone(),
        path,
        name,
        dir: true,
        size: 0,
        modified,
        kind: type_name("", true),
    }
}

#[cfg(target_os = "linux")]
fn trashed() -> Vec<ShellEntry> {
    trash::os_limited::list()
        .unwrap_or_default()
        .into_iter()
        .map(|item| {
            let path = item.original_path().to_string_lossy().into_owned();
            let name = item.name.to_string_lossy().into_owned();

            ShellEntry {
                kind: type_name(&extension(&name), false),
                key: item.id.to_string_lossy().into_owned(),
                modified: item.time_deleted.max(0) as u64 * 1000,
                size: 0,
                dir: false,
                path,
                name,
            }
        })
        .collect()
}

#[cfg(not(target_os = "linux"))]
fn trashed() -> Vec<ShellEntry> {
    Vec::new()
}

#[tauri::command]
pub async fn list_shell(app: AppHandle, path: String) -> Result<ShellListing> {
    let entries = match path.as_str() {
        HOME => places::folders(&app)
            .into_iter()
            .filter(|(id, _)| *id != "home")
            .map(|(_, folder)| folder_entry(folder))
            .collect(),
        RECYCLE_BIN => tauri::async_runtime::spawn_blocking(trashed).await?,
        _ => return Err(Error::Unsupported),
    };

    Ok(ShellListing {
        name: String::new(),
        path,
        entries,
    })
}
