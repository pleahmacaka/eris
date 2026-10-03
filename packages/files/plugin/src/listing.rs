use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::ipc::Channel;
use wildmatch::WildMatch;
use windows::core::Interface;
use windows::core::HSTRING;
use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, FILETIME};
use windows::Win32::Storage::EnhancedStorage::{PKEY_DateModified, PKEY_ItemTypeText, PKEY_Size};
use windows::Win32::Storage::FileSystem::{
    FindClose, FindExInfoBasic, FindExSearchNameMatch, FindFirstFileExW, FindNextFileW,
    FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_NORMAL, FILE_ATTRIBUTE_REPARSE_POINT,
    FILE_FLAGS_AND_ATTRIBUTES, FIND_FIRST_EX_LARGE_FETCH, WIN32_FIND_DATAW,
};
use windows::Win32::System::SystemServices::{IO_REPARSE_TAG_MOUNT_POINT, IO_REPARSE_TAG_SYMLINK};
use windows::Win32::UI::Shell::{
    BHID_EnumItems, IEnumShellItems, IShellItem, IShellItem2, SHGetFileInfoW, SHFILEINFOW,
    SHGFI_TYPENAME, SHGFI_USEFILEATTRIBUTES, SIGDN_DESKTOPABSOLUTEPARSING, SIGDN_NORMALDISPLAY,
};

use crate::com;
use crate::error::Result;

const SEARCH_LIMIT: usize = 20_000;

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

pub fn millis(time: FILETIME) -> u64 {
    let ticks = ((time.dwHighDateTime as u64) << 32) | time.dwLowDateTime as u64;

    ticks.saturating_sub(116_444_736_000_000_000) / 10_000
}

pub fn extension(name: &str) -> String {
    name.rfind('.')
        .map(|at| name[at..].to_lowercase())
        .unwrap_or_default()
}

fn pattern(dir: &str) -> String {
    let base = dir.trim_end_matches('\\');

    if base.len() < 240 {
        return format!("{base}\\*");
    }

    match base.strip_prefix("\\\\") {
        Some(unc) => format!("\\\\?\\UNC\\{unc}\\*"),
        None => format!("\\\\?\\{base}\\*"),
    }
}

fn scan(dir: &str, mut visit: impl FnMut(&WIN32_FIND_DATAW)) -> Result<()> {
    let mut data = WIN32_FIND_DATAW::default();

    let handle = unsafe {
        FindFirstFileExW(
            &HSTRING::from(pattern(dir)),
            FindExInfoBasic,
            &mut data as *mut _ as *mut _,
            FindExSearchNameMatch,
            None,
            FIND_FIRST_EX_LARGE_FETCH,
        )
    };

    let handle = match handle {
        Ok(handle) => handle,
        Err(error)
            if error.code() == ERROR_FILE_NOT_FOUND.to_hresult() && Path::new(dir).is_dir() =>
        {
            return Ok(());
        }
        Err(error) => return Err(error.into()),
    };

    loop {
        let name = &data.cFileName;
        let dots =
            name[0] == b'.' as u16 && (name[1] == 0 || (name[1] == b'.' as u16 && name[2] == 0));

        if !dots {
            visit(&data);
        }

        if unsafe { FindNextFileW(handle, &mut data) }.is_err() {
            break;
        }
    }

    let _ = unsafe { FindClose(handle) };

    Ok(())
}

fn entry(data: &WIN32_FIND_DATAW) -> Entry {
    let dir = data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY.0 != 0;
    let reparse = data.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT.0 != 0;

    Entry {
        name: com::wide(&data.cFileName),
        dir,
        size: if dir {
            0
        } else {
            ((data.nFileSizeHigh as u64) << 32) | data.nFileSizeLow as u64
        },
        modified: millis(data.ftLastWriteTime),
        attrs: data.dwFileAttributes,
        link: reparse
            && [IO_REPARSE_TAG_SYMLINK, IO_REPARSE_TAG_MOUNT_POINT].contains(&data.dwReserved0),
    }
}

fn type_cache() -> &'static Mutex<HashMap<String, String>> {
    static CACHE: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

    CACHE.get_or_init(Default::default)
}

pub fn type_name(extension: &str, dir: bool) -> String {
    let key = if dir { "/" } else { extension };

    if let Some(hit) = type_cache().lock().unwrap().get(key) {
        return hit.clone();
    }

    let (probe, attributes) = match (dir, extension) {
        (true, _) => ("folder".to_string(), FILE_ATTRIBUTE_DIRECTORY),
        (false, "") => ("file".to_string(), FILE_ATTRIBUTE_NORMAL),
        (false, ext) => (format!("file{ext}"), FILE_ATTRIBUTE_NORMAL),
    };

    let mut info = SHFILEINFOW::default();

    unsafe {
        SHGetFileInfoW(
            &HSTRING::from(probe),
            FILE_FLAGS_AND_ATTRIBUTES(attributes.0),
            Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_TYPENAME | SHGFI_USEFILEATTRIBUTES,
        )
    };

    let name = com::wide(&info.szTypeName);

    type_cache()
        .lock()
        .unwrap()
        .insert(key.to_string(), name.clone());

    name
}

fn list(path: String) -> Result<Listing> {
    let mut entries = Vec::new();

    scan(&path, |data| entries.push(entry(data)))?;

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
    com::sta(move || list(path)).await?
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

        let _ = scan(&dir, |data| {
            let item = entry(data);
            let linked = item.attrs & FILE_ATTRIBUTE_REPARSE_POINT.0 != 0;

            if item.dir && !linked {
                queue.push_back(format!("{}\\{}", dir.trim_end_matches('\\'), item.name));
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

        let _ = scan(&dir, |data| {
            let item = entry(data);

            if !item.dir {
                total += item.size;
            } else if item.attrs & FILE_ATTRIBUTE_REPARSE_POINT.0 == 0 {
                queue.push_back(format!("{}\\{}", dir.trim_end_matches('\\'), item.name));
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
    com::sta(move || search(root, query, token, batch)).await
}

fn shell_entry(item: &IShellItem) -> Option<ShellEntry> {
    let key = com::key_of(item)?;
    let dir = com::is_folder(item);
    let rich = item.cast::<IShellItem2>().ok();

    let size = rich
        .as_ref()
        .and_then(|rich| unsafe { rich.GetUInt64(&PKEY_Size) }.ok())
        .unwrap_or_default();

    let modified = rich
        .as_ref()
        .and_then(|rich| unsafe { rich.GetFileTime(&PKEY_DateModified) }.ok())
        .map(millis)
        .unwrap_or_default();

    let kind = rich
        .as_ref()
        .and_then(|rich| unsafe { rich.GetString(&PKEY_ItemTypeText) }.ok())
        .map(com::take)
        .unwrap_or_default();

    Some(ShellEntry {
        key,
        path: com::display(item, SIGDN_DESKTOPABSOLUTEPARSING),
        name: com::display(item, SIGDN_NORMALDISPLAY),
        dir,
        size,
        modified,
        kind,
    })
}

fn shell_list(path: String) -> Result<ShellListing> {
    let folder = com::item(&path)?;
    let walker: IEnumShellItems = unsafe { folder.BindToHandler(None, &BHID_EnumItems) }?;

    let mut entries = Vec::new();

    loop {
        let mut slot = [None];
        let mut fetched = 0u32;

        if unsafe { walker.Next(&mut slot, Some(&mut fetched)) }.is_err() || fetched == 0 {
            break;
        }

        if let Some(entry) = slot[0].as_ref().and_then(shell_entry) {
            entries.push(entry);
        }
    }

    Ok(ShellListing {
        name: com::display(&folder, SIGDN_NORMALDISPLAY),
        path,
        entries,
    })
}

#[tauri::command]
pub async fn list_shell(path: String) -> Result<ShellListing> {
    com::sta(move || shell_list(path)).await?
}
