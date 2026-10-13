use std::collections::HashMap;
use std::fs::File;
use std::hash::{DefaultHasher, Hasher};
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

use serde::Serialize;

use crate::error::Result;
use crate::git::{head_of, Head};

const PROBE: u64 = 4 * 1024;

const FULL_LIMIT: u64 = 64 * 1024 * 1024;

const SAMPLE: u64 = 64 * 1024;

const SAMPLES: u64 = 16;

#[derive(Serialize, Default)]
pub struct Probe {
    empty: Vec<String>,
    repos: Vec<String>,
    submodules: Vec<String>,
    heads: HashMap<String, Head>,
}

type Ranges = Vec<(u64, u64)>;

fn digest(path: &str, ranges: &[(u64, u64)], buffer: &mut [u8]) -> Option<u64> {
    let mut file = File::open(path).ok()?;
    let mut hasher = DefaultHasher::new();

    for &(start, length) in ranges {
        file.seek(SeekFrom::Start(start)).ok()?;
        let mut reader = (&mut file).take(length);

        loop {
            let read = reader.read(buffer).ok()?;

            if read == 0 {
                break;
            }

            hasher.write(&buffer[..read]);
        }
    }

    Some(hasher.finish())
}

fn split(group: Vec<String>, ranges: &[(u64, u64)], buffer: &mut [u8]) -> Vec<Vec<String>> {
    let mut same: HashMap<u64, Vec<String>> = HashMap::new();

    for path in group {
        if let Some(hash) = digest(&path, ranges, buffer) {
            same.entry(hash).or_default().push(path);
        }
    }

    same.into_values().filter(|paths| paths.len() > 1).collect()
}

// ponytail: files over FULL_LIMIT compare sampled chunks, not every byte
fn passes(size: u64) -> Vec<Ranges> {
    if size <= PROBE {
        return vec![vec![(0, size)]];
    }

    let body = if size <= FULL_LIMIT {
        vec![(0, size)]
    } else {
        (0..SAMPLES)
            .map(|index| (index * (size - SAMPLE) / (SAMPLES - 1), SAMPLE))
            .collect()
    };

    vec![vec![(0, PROBE)], vec![(size - PROBE, PROBE)], body]
}

fn identical(groups: Vec<Vec<String>>) -> Vec<Vec<String>> {
    let mut buffer = vec![0; 1 << 20];
    let mut found = Vec::new();

    for group in groups {
        let Some(size) = group
            .first()
            .and_then(|path| std::fs::metadata(path).ok())
            .map(|meta| meta.len())
        else {
            continue;
        };

        let mut candidates = vec![group];

        for ranges in passes(size) {
            candidates = candidates
                .into_iter()
                .flat_map(|candidate| split(candidate, &ranges, &mut buffer))
                .collect();
        }

        found.extend(candidates);
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

        if let Some(head) = marker.exists().then(|| head_of(Path::new(&path))).flatten() {
            found.heads.insert(path.clone(), head);
        }

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
