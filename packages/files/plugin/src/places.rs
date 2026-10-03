use std::collections::BTreeSet;
use std::path::Path;
use std::sync::{mpsc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;
use windows::core::{GUID, HSTRING};
use windows::Win32::Storage::FileSystem::{
    GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW,
};
use windows::Win32::UI::Shell::{
    FOLDERID_Desktop, FOLDERID_Documents, FOLDERID_Downloads, FOLDERID_Music, FOLDERID_Pictures,
    FOLDERID_Profile, FOLDERID_Videos, SHGetKnownFolderPath, SHGetSetSettings, KNOWN_FOLDER_FLAG,
    SHELLSTATEA, SSF_NOCONFIRMRECYCLE, SSF_SHOWALLOBJECTS, SSF_SHOWEXTENSIONS,
};
use winreg::enums::HKEY_CURRENT_USER;
use winreg::RegKey;

use crate::error::Result;
use crate::{com, network};

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

const KNOWN: [(&str, GUID); 7] = [
    ("home", FOLDERID_Profile),
    ("desktop", FOLDERID_Desktop),
    ("downloads", FOLDERID_Downloads),
    ("documents", FOLDERID_Documents),
    ("pictures", FOLDERID_Pictures),
    ("music", FOLDERID_Music),
    ("videos", FOLDERID_Videos),
];

pub fn known_folder(id: &GUID) -> Option<String> {
    let raw = unsafe { SHGetKnownFolderPath(id, KNOWN_FOLDER_FLAG(0), None) }.ok()?;
    let path = com::take(raw);

    (!path.is_empty()).then_some(path)
}

#[tauri::command]
pub async fn known_folders() -> Result<Vec<Known>> {
    let found = tauri::async_runtime::spawn_blocking(|| {
        KNOWN
            .iter()
            .filter_map(|(id, guid)| {
                let path = known_folder(guid)?;

                Path::new(&path).is_dir().then_some(Known { id, path })
            })
            .collect()
    });

    Ok(found.await?)
}

const NETWORK_WAIT: Duration = Duration::from_millis(800);

static PROBING: Mutex<BTreeSet<char>> = Mutex::new(BTreeSet::new());

fn root_of(letter: char) -> String {
    format!("{letter}:\\")
}

fn kind_of(root: &str) -> Option<&'static str> {
    match unsafe { GetDriveTypeW(&HSTRING::from(root)) } {
        2 => Some("removable"),
        3 => Some("fixed"),
        4 => Some("network"),
        5 => Some("optical"),
        6 => Some("ram"),
        _ => None,
    }
}

fn volume(root: &str) -> (String, u64, u64) {
    let wide = HSTRING::from(root);
    let mut label = [0u16; 261];
    let named =
        unsafe { GetVolumeInformationW(&wide, Some(&mut label), None, None, None, None) }.is_ok();

    let mut free = 0u64;
    let mut total = 0u64;
    let _ = unsafe { GetDiskFreeSpaceExW(&wide, None, Some(&mut total), Some(&mut free)) };

    let label = if named {
        com::wide(&label)
    } else {
        String::new()
    };

    (label, free, total)
}

fn offline(letter: char, remote: String) -> Drive {
    Drive {
        path: root_of(letter),
        label: String::new(),
        kind: "network",
        free: 0,
        total: 0,
        remote,
        connected: false,
    }
}

type Volume = (String, u64, u64);

// a dead network share can hang its probe for minutes, so one stuck probe per letter is the cap
fn probe(letter: char) -> Option<mpsc::Receiver<Volume>> {
    if !PROBING.lock().unwrap().insert(letter) {
        return None;
    }

    let (sender, receiver) = mpsc::channel();

    std::thread::spawn(move || {
        let found = volume(&root_of(letter));

        PROBING.lock().unwrap().remove(&letter);

        let _ = sender.send(found);
    });

    Some(receiver)
}

fn list_drives() -> Vec<Drive> {
    let mask = unsafe { GetLogicalDrives() };
    let letters = (0..26u8)
        .filter(|index| mask & (1 << index) != 0)
        .map(|index| char::from(b'A' + index));

    let mut local = Vec::new();
    let mut pending = Vec::new();

    for letter in letters {
        let root = root_of(letter);

        match kind_of(&root) {
            Some("network") => {
                let mapping = network::mapping(letter);
                let remote = mapping
                    .as_ref()
                    .map(|m| m.remote.clone())
                    .unwrap_or_default();

                if mapping.is_some_and(|m| !m.connected) {
                    local.push(offline(letter, remote));
                } else {
                    pending.push((letter, remote, probe(letter)));
                }
            }
            Some(kind) => {
                let (label, free, total) = volume(&root);

                local.push(Drive {
                    path: root,
                    label,
                    kind,
                    free,
                    total,
                    remote: String::new(),
                    connected: true,
                });
            }
            None => {}
        }
    }

    let deadline = Instant::now() + NETWORK_WAIT;

    for (letter, remote, receiver) in pending {
        let (label, free, total) = receiver
            .and_then(|receiver| {
                receiver
                    .recv_timeout(deadline.saturating_duration_since(Instant::now()))
                    .ok()
            })
            .unwrap_or_default();

        local.push(Drive {
            path: root_of(letter),
            label,
            kind: "network",
            free,
            total,
            remote,
            connected: true,
        });
    }

    for (letter, remote) in network::remembered() {
        if !local.iter().any(|drive| drive.path == root_of(letter)) {
            local.push(offline(letter, remote));
        }
    }

    local.sort_by(|a, b| a.path.cmp(&b.path));

    local
}

#[tauri::command]
pub async fn drives() -> Result<Vec<Drive>> {
    Ok(tauri::async_runtime::spawn_blocking(list_drives).await?)
}

const LXSS: &str = r"Software\Microsoft\Windows\CurrentVersion\Lxss";

fn lxss() -> Option<RegKey> {
    RegKey::predef(HKEY_CURRENT_USER).open_subkey(LXSS).ok()
}

fn distro_name(lxss: &RegKey, id: &str) -> Option<String> {
    lxss.open_subkey(id)
        .ok()?
        .get_value("DistributionName")
        .ok()
}

pub fn wsl_root(name: &str) -> String {
    format!(r"\\wsl.localhost\{name}")
}

pub fn default_distro() -> Option<String> {
    let lxss = lxss()?;
    let id: String = lxss.get_value("DefaultDistribution").ok()?;

    distro_name(&lxss, &id)
}

#[tauri::command]
pub fn wsl_distros() -> Vec<Distro> {
    let Some(lxss) = lxss() else {
        return Vec::new();
    };

    let mut found: Vec<Distro> = lxss
        .enum_keys()
        .flatten()
        .filter_map(|id| distro_name(&lxss, &id))
        .map(|name| Distro {
            path: wsl_root(&name),
            name,
        })
        .collect();

    found.sort_by_key(|distro| distro.name.to_lowercase());

    found
}

pub fn shell_state(mask: windows::Win32::UI::Shell::SSF_MASK) -> i32 {
    let mut state = SHELLSTATEA::default();

    unsafe { SHGetSetSettings(Some(&mut state), mask, false) };

    state._bitfield1
}

pub fn confirm_recycle() -> bool {
    shell_state(SSF_NOCONFIRMRECYCLE) & 0b100 == 0
}

#[tauri::command]
pub fn explorer_settings() -> ExplorerSettings {
    let bits = shell_state(SSF_SHOWALLOBJECTS | SSF_SHOWEXTENSIONS);

    ExplorerSettings {
        show_hidden: bits & 0b1 != 0,
        show_extensions: bits & 0b10 != 0,
    }
}
