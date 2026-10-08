use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;
use tauri::WebviewWindow;
use windows::core::{HSTRING, PCWSTR, PWSTR};
use windows::Win32::Foundation::{ERROR_CONNECTION_UNAVAIL, ERROR_MORE_DATA, HANDLE, NO_ERROR};
use windows::Win32::NetworkManagement::WNet::{
    WNetAddConnection3W, WNetCancelConnection2W, WNetCloseEnum, WNetConnectionDialog,
    WNetDisconnectDialog, WNetEnumResourceW, WNetGetConnectionW, WNetOpenEnumW,
    CONNECT_INTERACTIVE, CONNECT_UPDATE_PROFILE, NETRESOURCEW, RESOURCETYPE_DISK,
    RESOURCEUSAGE_NONE, RESOURCE_REMEMBERED,
};
use windows::Win32::UI::Shell::{FOLDERID_NetHood, SIGDN_DESKTOPABSOLUTEPARSING};

use crate::error::{Error, Result};
use crate::{com, places};

#[derive(Serialize)]
pub struct NetworkPlace {
    name: String,
    path: String,
    entry: String,
}

pub struct Mapping {
    pub remote: String,
    pub connected: bool,
}

fn device(letter: char) -> HSTRING {
    HSTRING::from(format!("{letter}:"))
}

fn letter_of(path: &str) -> Result<char> {
    let mut chars = path.chars();

    match (chars.next(), chars.next()) {
        (Some(letter), Some(':')) if letter.is_ascii_alphabetic() => {
            Ok(letter.to_ascii_uppercase())
        }
        _ => Err(Error::Missing),
    }
}

fn text(raw: PWSTR) -> String {
    if raw.is_null() {
        return String::new();
    }

    unsafe { raw.to_string() }.unwrap_or_default()
}

pub fn mapping(letter: char) -> Option<Mapping> {
    let mut buffer = vec![0u16; 1024];
    let mut length = buffer.len() as u32;
    let result = unsafe {
        WNetGetConnectionW(
            &device(letter),
            Some(PWSTR(buffer.as_mut_ptr())),
            &mut length,
        )
    };

    if result != NO_ERROR && result != ERROR_CONNECTION_UNAVAIL {
        return None;
    }

    Some(Mapping {
        remote: com::wide(&buffer),
        connected: result == NO_ERROR,
    })
}

pub fn remembered() -> Vec<(char, String)> {
    let mut handle = HANDLE::default();
    let opened = unsafe {
        WNetOpenEnumW(
            RESOURCE_REMEMBERED,
            RESOURCETYPE_DISK,
            RESOURCEUSAGE_NONE,
            None,
            &mut handle,
        )
    };

    if opened != NO_ERROR {
        return Vec::new();
    }

    let mut found = Vec::new();
    let mut buffer = vec![0u64; 2048];

    loop {
        let mut count = u32::MAX;
        let mut size = (buffer.len() * 8) as u32;
        let result = unsafe {
            WNetEnumResourceW(handle, &mut count, buffer.as_mut_ptr() as *mut _, &mut size)
        };

        if result == ERROR_MORE_DATA {
            buffer.resize(size as usize / 8 + 1, 0);
            continue;
        }

        if result != NO_ERROR {
            break;
        }

        let entries = unsafe {
            std::slice::from_raw_parts(buffer.as_ptr() as *const NETRESOURCEW, count as usize)
        };

        for entry in entries {
            let local = text(entry.lpLocalName);

            if let Ok(letter) = letter_of(&local) {
                found.push((letter, text(entry.lpRemoteName)));
            }
        }
    }

    let _ = unsafe { WNetCloseEnum(handle) };

    found
}

fn link_target(link: &Path) -> Option<String> {
    let target = com::stored_link_target(&link.to_string_lossy())?;
    let path = com::display(&target, SIGDN_DESKTOPABSOLUTEPARSING);

    (!path.is_empty()).then_some(path)
}

fn shortcut(entry: &Path) -> Option<NetworkPlace> {
    let link: PathBuf = if entry.is_dir() {
        entry.join("target.lnk")
    } else if entry
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk"))
    {
        entry.to_path_buf()
    } else {
        return None;
    };

    Some(NetworkPlace {
        name: entry.file_stem()?.to_string_lossy().to_string(),
        path: link_target(&link)?,
        entry: entry.to_string_lossy().to_string(),
    })
}

fn places() -> Vec<NetworkPlace> {
    let Some(root) = places::known_folder(&FOLDERID_NetHood) else {
        return Vec::new();
    };

    let Ok(entries) = std::fs::read_dir(root) else {
        return Vec::new();
    };

    let mut found: Vec<NetworkPlace> = entries
        .flatten()
        .filter_map(|entry| shortcut(&entry.path()))
        .collect();

    found.sort_by_key(|place| place.name.to_lowercase());

    found
}

#[tauri::command]
pub async fn network_places() -> Result<Vec<NetworkPlace>> {
    com::sta(places).await
}

fn reconnect(owner: isize, path: &str) -> Result<()> {
    let letter = letter_of(path)?;
    let remote = mapping(letter)
        .map(|mapping| mapping.remote)
        .filter(|remote| !remote.is_empty())
        .ok_or(Error::Missing)?;

    let local = device(letter);
    let remote = HSTRING::from(remote);
    let resource = NETRESOURCEW {
        dwType: RESOURCETYPE_DISK,
        lpLocalName: PWSTR(local.as_ptr() as *mut _),
        lpRemoteName: PWSTR(remote.as_ptr() as *mut _),
        ..Default::default()
    };

    let connected = unsafe {
        WNetAddConnection3W(
            Some(com::owner(owner)),
            &resource,
            PCWSTR::null(),
            PCWSTR::null(),
            CONNECT_INTERACTIVE,
        )
    };

    Ok(connected.ok()?)
}

#[tauri::command]
pub async fn reconnect_drive(window: WebviewWindow, path: String) -> Result<()> {
    let owner = com::hwnd(&window);

    com::sta(move || reconnect(owner, &path)).await?
}

#[tauri::command]
pub async fn disconnect_drive(path: String) -> Result<()> {
    let letter = letter_of(&path)?;
    let cancelled = com::sta(move || unsafe {
        WNetCancelConnection2W(&device(letter), CONNECT_UPDATE_PROFILE, false)
    });

    Ok(cancelled.await?.ok()?)
}

#[tauri::command]
pub async fn map_network_drive(window: WebviewWindow) -> Result<()> {
    let owner = com::hwnd(&window);
    let shown =
        com::sta(move || unsafe { WNetConnectionDialog(com::owner(owner), RESOURCETYPE_DISK.0) });

    Ok(shown.await?.ok()?)
}

#[tauri::command]
pub async fn disconnect_network_drive(window: WebviewWindow) -> Result<()> {
    let owner = com::hwnd(&window);
    let shown = com::sta(move || unsafe {
        WNetDisconnectDialog(Some(com::owner(owner)), RESOURCETYPE_DISK.0)
    });

    Ok(shown.await?.ok()?)
}

#[tauri::command]
pub async fn add_network_location() -> Result<()> {
    let wizard = tauri::async_runtime::spawn_blocking(|| {
        Command::new("rundll32.exe")
            .arg("shwebsvc.dll,AddNetPlaceRunDll")
            .status()
    });

    wizard.await??;

    Ok(())
}
