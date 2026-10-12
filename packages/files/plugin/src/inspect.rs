use std::collections::HashMap;
use std::fs::File;
use std::hash::{DefaultHasher, Hasher};
use std::io::Read;
use std::path::Path;

use serde::Serialize;

use crate::error::Result;

const HEAD: u64 = 64 * 1024;

#[derive(Serialize, Default)]
pub struct Probe {
    empty: Vec<String>,
    repos: Vec<String>,
    submodules: Vec<String>,
}

fn digest(path: &str, limit: u64, buffer: &mut [u8]) -> Option<u64> {
    let mut reader = File::open(path).ok()?.take(limit);
    let mut hasher = DefaultHasher::new();

    loop {
        let read = reader.read(buffer).ok()?;

        if read == 0 {
            return Some(hasher.finish());
        }

        hasher.write(&buffer[..read]);
    }
}

fn split(group: Vec<String>, limit: u64, buffer: &mut [u8]) -> Vec<Vec<String>> {
    let mut same: HashMap<u64, Vec<String>> = HashMap::new();

    for path in group {
        if let Some(hash) = digest(&path, limit, buffer) {
            same.entry(hash).or_default().push(path);
        }
    }

    same.into_values().filter(|paths| paths.len() > 1).collect()
}

fn identical(groups: Vec<Vec<String>>) -> Vec<Vec<String>> {
    let mut buffer = vec![0; 1 << 20];
    let mut found = Vec::new();

    for group in groups {
        let small = group
            .first()
            .and_then(|path| std::fs::metadata(path).ok())
            .is_some_and(|meta| meta.len() <= HEAD);

        for heads in split(group, HEAD, &mut buffer) {
            if small {
                found.push(heads);
            } else {
                found.extend(split(heads, u64::MAX, &mut buffer));
            }
        }
    }

    found
}

#[tauri::command]
pub async fn identical_files(groups: Vec<Vec<String>>) -> Result<Vec<Vec<String>>> {
    Ok(tauri::async_runtime::spawn_blocking(move || identical(groups)).await?)
}

fn probe(paths: Vec<String>) -> Probe {
    let mut found = Probe::default();

    for path in paths {
        let Ok(mut entries) = std::fs::read_dir(&path) else {
            continue;
        };

        if entries.next().is_none() {
            found.empty.push(path);

            continue;
        }

        let marker = Path::new(&path).join(".git");

        if marker.is_dir() {
            found.repos.push(path);
        } else if marker.is_file() {
            // a linked worktree also has a .git file, but its gitdir points into worktrees/
            let gitdir = std::fs::read_to_string(&marker).unwrap_or_default();

            if gitdir.replace('\\', "/").contains("/modules/") {
                found.submodules.push(path);
            } else {
                found.repos.push(path);
            }
        }
    }

    found
}

#[tauri::command]
pub async fn probe_dirs(paths: Vec<String>) -> Result<Probe> {
    Ok(tauri::async_runtime::spawn_blocking(move || probe(paths)).await?)
}
