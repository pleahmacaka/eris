use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;

use rayon::prelude::*;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{Error, Result};

const SHOWN_DEPTH: usize = 5;
const SHOWN_CHILDREN: usize = 40;
const SHOWN_SHARE: u64 = 200;
const PROGRESS_EVERY: Duration = Duration::from_millis(250);

#[cfg(windows)]
const CLOUD_ONLY: u32 = 0x1000 | 0x40000 | 0x400000;

struct Node {
    name: String,
    size: u64,
    files: u64,
    children: Vec<Node>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct View {
    name: String,
    size: u64,
    files: u64,
    folder: bool,
    children: Vec<View>,
    rest: u64,
}

#[derive(Clone, Serialize)]
struct Progress {
    token: u32,
    files: u64,
    bytes: u64,
}

struct Scan {
    stop: AtomicBool,
    files: AtomicU64,
    bytes: AtomicU64,
}

fn scans() -> &'static Mutex<HashMap<u32, Arc<Scan>>> {
    static SCANS: OnceLock<Mutex<HashMap<u32, Arc<Scan>>>> = OnceLock::new();

    SCANS.get_or_init(Default::default)
}

fn trees() -> &'static Mutex<HashMap<u32, Arc<Node>>> {
    static TREES: OnceLock<Mutex<HashMap<u32, Arc<Node>>>> = OnceLock::new();

    TREES.get_or_init(Default::default)
}

#[cfg(windows)]
fn counted(meta: &std::fs::Metadata) -> (bool, u64) {
    use std::os::windows::fs::MetadataExt;

    let attrs = meta.file_attributes();
    let reparse = attrs & 0x400 != 0;
    let size = if attrs & CLOUD_ONLY != 0 {
        0
    } else {
        meta.len()
    };

    (reparse, size)
}

#[cfg(not(windows))]
fn counted(meta: &std::fs::Metadata) -> (bool, u64) {
    (meta.file_type().is_symlink(), meta.len())
}

fn walk(path: &Path, name: String, scan: &Scan) -> Node {
    let mut node = Node {
        name,
        size: 0,
        files: 0,
        children: Vec::new(),
    };

    if scan.stop.load(Ordering::Relaxed) {
        return node;
    }

    let Ok(entries) = std::fs::read_dir(path) else {
        return node;
    };

    let mut folders: Vec<(PathBuf, String)> = Vec::new();

    for entry in entries.flatten() {
        let Ok(meta) = entry.metadata() else {
            continue;
        };

        let (reparse, size) = counted(&meta);

        if meta.is_dir() {
            if !reparse {
                folders.push((
                    entry.path(),
                    entry.file_name().to_string_lossy().into_owned(),
                ));
            }

            continue;
        }

        node.files += 1;
        node.size += size;
    }

    scan.files.fetch_add(node.files, Ordering::Relaxed);
    scan.bytes.fetch_add(node.size, Ordering::Relaxed);

    node.children = folders
        .into_par_iter()
        .map(|(path, name)| walk(&path, name, scan))
        .collect();

    for child in &node.children {
        node.size += child.size;
        node.files += child.files;
    }

    node.children
        .sort_by_key(|child| std::cmp::Reverse(child.size));

    node
}

fn view(node: &Node, depth: usize) -> View {
    let floor = node.size / SHOWN_SHARE;

    let shown: Vec<&Node> = if depth == 0 {
        Vec::new()
    } else {
        node.children
            .iter()
            .take(SHOWN_CHILDREN)
            .filter(|child| child.size > 0 && child.size >= floor)
            .collect()
    };

    let children: Vec<View> = shown.iter().map(|child| view(child, depth - 1)).collect();
    let listed: u64 = children.iter().map(|child| child.size).sum();

    View {
        name: node.name.clone(),
        size: node.size,
        files: node.files,
        folder: !node.children.is_empty(),
        rest: node.size - listed,
        children,
    }
}

fn find<'a>(root: &'a Node, trail: &[String]) -> Option<&'a Node> {
    trail.iter().try_fold(root, |node, name| {
        node.children.iter().find(|child| child.name == *name)
    })
}

#[tauri::command]
pub async fn usage_scan(app: AppHandle, path: String, token: u32) -> Result<Option<View>> {
    let root = PathBuf::from(&path);

    if !root.is_dir() {
        return Err(Error::Missing);
    }

    let scan = Arc::new(Scan {
        stop: AtomicBool::new(false),
        files: AtomicU64::new(0),
        bytes: AtomicU64::new(0),
    });

    scans().lock().unwrap().insert(token, scan.clone());

    let ticker = scan.clone();
    let done = Arc::new(AtomicBool::new(false));
    let finished = done.clone();

    std::thread::spawn(move || {
        while !finished.load(Ordering::Relaxed) && !ticker.stop.load(Ordering::Relaxed) {
            std::thread::sleep(PROGRESS_EVERY);

            let _ = app.emit(
                "usage-progress",
                Progress {
                    token,
                    files: ticker.files.load(Ordering::Relaxed),
                    bytes: ticker.bytes.load(Ordering::Relaxed),
                },
            );
        }
    });

    let walker = scan.clone();
    let tree = tauri::async_runtime::spawn_blocking(move || walk(&root, path, &walker)).await;

    done.store(true, Ordering::Relaxed);
    scans().lock().unwrap().remove(&token);

    if scan.stop.load(Ordering::Relaxed) {
        return Ok(None);
    }

    let tree = Arc::new(tree?);
    let shown = view(&tree, SHOWN_DEPTH);

    trees().lock().unwrap().insert(token, tree);

    Ok(Some(shown))
}

#[tauri::command]
pub fn usage_tree(token: u32, trail: Vec<String>) -> Option<View> {
    let tree = trees().lock().unwrap().get(&token)?.clone();

    find(&tree, &trail).map(|node| view(node, SHOWN_DEPTH))
}

#[tauri::command]
pub fn usage_forget(token: u32) {
    if let Some(scan) = scans().lock().unwrap().remove(&token) {
        scan.stop.store(true, Ordering::Relaxed);
    }

    trees().lock().unwrap().remove(&token);
}
