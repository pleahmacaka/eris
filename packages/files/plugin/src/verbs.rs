use std::collections::HashSet;
use std::path::Path;
use std::sync::OnceLock;

use data_encoding::BASE64;
use serde::Serialize;
use tauri::{AppHandle, WebviewWindow};
use windows::core::{Interface, GUID, HSTRING, PCSTR, PCWSTR, PWSTR};
use windows::Win32::Foundation::{HWND, POINT};
use windows::Win32::System::Com::{
    CLSIDFromString, CoCreateInstance, IDataObject, CLSCTX_INPROC_SERVER,
};
use windows::Win32::UI::Shell::{
    BHID_DataObject, IContextMenu, IShellExtInit, SHGetIDListFromObject, CMF_NORMAL,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreatePopupMenu, DestroyMenu, GetCursorPos, GetMenuItemCount, GetMenuItemInfoW, HMENU,
    MENUITEMINFOW, MFS_DISABLED, MFT_SEPARATOR, MIIM_BITMAP, MIIM_FTYPE, MIIM_ID, MIIM_STATE,
    MIIM_STRING, MIIM_SUBMENU,
};
use winreg::enums::HKEY_CLASSES_ROOT;
use winreg::RegKey;

use crate::actions::{context_menu, invoke, verb_of, FIRST_COMMAND, LAST_COMMAND};
use crate::com;
use crate::error::{Error, Result};

const OWN_VERBS: &[&str] = &[
    "open",
    "opennew",
    "opennewtab",
    "opennewwindow",
    "opennewprocess",
    "explore",
    "openas",
    "cut",
    "copy",
    "paste",
    "delete",
    "rename",
    "properties",
    "copyaspath",
    "pintohome",
    "unpinfromhome",
    "newfolder",
    "refresh",
    "find",
];

const HANDLER_KEYS: &[&str] = &[
    "*",
    "AllFilesystemObjects",
    "Directory",
    "Directory\\Background",
    "Folder",
];

#[derive(Serialize)]
pub struct ShellVerb {
    verb: String,
    label: String,
    icon: Option<String>,
}

struct Entry {
    offset: u32,
    verb: String,
    label: String,
    icon: Option<String>,
}

fn clean(raw: &str) -> String {
    let text = raw.split('\t').next().unwrap_or_default();
    let mut label = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();

    while let Some(c) = chars.next() {
        if c != '&' {
            label.push(c);
        } else if chars.peek() == Some(&'&') {
            label.push('&');
            chars.next();
        }
    }

    let label = label.trim();
    let chars: Vec<char> = label.chars().collect();

    // localized menus append the access key as "(K)" instead of underlining it
    match chars.as_slice() {
        [.., '(', key, ')'] if key.is_ascii_alphanumeric() => chars[..chars.len() - 3]
            .iter()
            .collect::<String>()
            .trim_end()
            .to_string(),
        _ => label.to_string(),
    }
}

// HBMMENU_* constants are small sentinel values, not bitmaps
fn icon_of(bitmap: windows::Win32::Graphics::Gdi::HBITMAP) -> Option<String> {
    if (bitmap.0 as isize).unsigned_abs() <= 11 {
        return None;
    }

    crate::thumbs::bitmap_png(bitmap)
        .map(|png| format!("data:image/png;base64,{}", BASE64.encode(&png)))
}

fn entries(menu: &IContextMenu, popup: HMENU, icons: bool) -> Vec<Entry> {
    let count = unsafe { GetMenuItemCount(Some(popup)) }.max(0) as u32;
    let mut found = Vec::new();

    for index in 0..count {
        let mut text = [0u16; 260];
        let mut info = MENUITEMINFOW {
            cbSize: std::mem::size_of::<MENUITEMINFOW>() as u32,
            fMask: MIIM_FTYPE | MIIM_STATE | MIIM_ID | MIIM_SUBMENU | MIIM_STRING | MIIM_BITMAP,
            dwTypeData: PWSTR(text.as_mut_ptr()),
            cch: text.len() as u32 - 1,
            ..Default::default()
        };

        if unsafe { GetMenuItemInfoW(popup, index, true, &mut info) }.is_err() {
            continue;
        }

        let separator = info.fType.0 & MFT_SEPARATOR.0 != 0;
        let disabled = info.fState.0 & MFS_DISABLED.0 != 0;
        let label = clean(&com::wide(&text));

        if separator || disabled || label.is_empty() || !info.hSubMenu.is_invalid() {
            continue;
        }

        let Some(offset) = info.wID.checked_sub(FIRST_COMMAND) else {
            continue;
        };

        found.push(Entry {
            offset,
            verb: verb_of(menu, offset),
            label,
            icon: icons.then(|| icon_of(info.hbmpItem)).flatten(),
        });
    }

    found
}

fn labels(popup: HMENU) -> HashSet<String> {
    let count = unsafe { GetMenuItemCount(Some(popup)) }.max(0) as u32;

    (0..count)
        .filter_map(|index| {
            let mut text = [0u16; 260];
            let mut info = MENUITEMINFOW {
                cbSize: std::mem::size_of::<MENUITEMINFOW>() as u32,
                fMask: MIIM_STRING,
                dwTypeData: PWSTR(text.as_mut_ptr()),
                cch: text.len() as u32 - 1,
                ..Default::default()
            };

            unsafe { GetMenuItemInfoW(popup, index, true, &mut info) }.ok()?;

            Some(clean(&com::wide(&text)))
        })
        .filter(|label| !label.is_empty())
        .collect()
}

fn bandizip_handlers() -> &'static [GUID] {
    static FOUND: OnceLock<Vec<GUID>> = OnceLock::new();

    FOUND.get_or_init(|| {
        let Some(install) = crate::archive::bandizip().and_then(Path::parent) else {
            return Vec::new();
        };
        let install = install.to_string_lossy().to_lowercase();
        let root = RegKey::predef(HKEY_CLASSES_ROOT);
        let mut found = Vec::new();

        for key in HANDLER_KEYS {
            let Ok(handlers) = root.open_subkey(format!("{key}\\shellex\\ContextMenuHandlers"))
            else {
                continue;
            };

            for name in handlers.enum_keys().flatten() {
                let clsid = handlers
                    .open_subkey(&name)
                    .and_then(|entry| entry.get_value::<String, _>(""))
                    .ok()
                    .filter(|value| value.starts_with('{'))
                    .unwrap_or(name);
                let module: String = root
                    .open_subkey(format!("CLSID\\{clsid}\\InprocServer32"))
                    .and_then(|server| server.get_value(""))
                    .unwrap_or_default();

                if !module.to_lowercase().starts_with(&install) {
                    continue;
                }

                if let Ok(guid) = unsafe { CLSIDFromString(&HSTRING::from(clsid)) } {
                    if !found.contains(&guid) {
                        found.push(guid);
                    }
                }
            }
        }

        found
    })
}

// the combined shell menu hides which handler added an item, so Bandizip's own menu supplies the labels to drop
fn handler_labels(clsid: &GUID, keys: &[String], folder: Option<&str>) -> Result<HashSet<String>> {
    let init: IShellExtInit = unsafe { CoCreateInstance(clsid, None, CLSCTX_INPROC_SERVER) }?;

    if keys.is_empty() {
        let item = com::item(folder.ok_or(Error::Missing)?)?;
        let list = com::Pidl::from_raw(unsafe { SHGetIDListFromObject(&item) }?);

        unsafe { init.Initialize(Some(list.as_ptr()), None, None) }?;
    } else {
        let data: IDataObject = unsafe { com::items(keys)?.BindToHandler(None, &BHID_DataObject) }?;

        unsafe { init.Initialize(None, &data, None) }?;
    }

    let menu: IContextMenu = init.cast()?;
    let popup = unsafe { CreatePopupMenu() }?;
    let built = unsafe { menu.QueryContextMenu(popup, 0, FIRST_COMMAND, LAST_COMMAND, CMF_NORMAL) };
    let found = if built.is_ok() {
        labels(popup)
    } else {
        HashSet::new()
    };

    let _ = unsafe { DestroyMenu(popup) };

    Ok(found)
}

fn with_menu<T>(
    owner: HWND,
    keys: &[String],
    folder: Option<&str>,
    use_menu: impl FnOnce(&IContextMenu, HMENU) -> T,
) -> Result<T> {
    let menu = context_menu(owner, keys, folder)?;
    let popup = unsafe { CreatePopupMenu() }?;
    let built = unsafe { menu.QueryContextMenu(popup, 0, FIRST_COMMAND, LAST_COMMAND, CMF_NORMAL) };

    let result = match built.ok() {
        Ok(()) => Ok(use_menu(&menu, popup)),
        Err(error) => Err(Error::Os(error.message())),
    };

    let _ = unsafe { DestroyMenu(popup) };

    result
}

fn list(owner: isize, keys: Vec<String>, folder: Option<String>) -> Result<Vec<ShellVerb>> {
    let hidden: HashSet<String> = bandizip_handlers()
        .iter()
        .filter_map(|clsid| handler_labels(clsid, &keys, folder.as_deref()).ok())
        .flatten()
        .collect();

    let found = with_menu(
        com::owner(owner),
        &keys,
        folder.as_deref(),
        |menu, popup| entries(menu, popup, true),
    )?;

    Ok(found
        .into_iter()
        .filter(|entry| !hidden.contains(&entry.label))
        .filter(|entry| !OWN_VERBS.contains(&entry.verb.to_lowercase().as_str()))
        .map(|entry| ShellVerb {
            verb: entry.verb,
            label: entry.label,
            icon: entry.icon,
        })
        .collect())
}

#[tauri::command]
pub async fn shell_verbs(
    window: WebviewWindow,
    items: Vec<String>,
    folder: Option<String>,
) -> Result<Vec<ShellVerb>> {
    let owner = com::hwnd(&window);

    com::sta(move || list(owner, items, folder)).await?
}

#[tauri::command]
pub async fn run_shell_verb(
    app: AppHandle,
    window: WebviewWindow,
    items: Vec<String>,
    folder: Option<String>,
    verb: String,
    label: String,
) -> Result<()> {
    let owner = com::hwnd(&window);

    com::ui(&app, move || {
        let hwnd = com::owner(owner);

        with_menu(hwnd, &items, folder.as_deref(), |menu, popup| {
            let chosen = entries(menu, popup, false)
                .into_iter()
                .find(|entry| entry.label == label && entry.verb == verb)
                .ok_or(Error::Missing)?;
            let mut point = POINT::default();
            let _ = unsafe { GetCursorPos(&mut point) };

            invoke(
                menu,
                hwnd,
                PCSTR(chosen.offset as usize as *const u8),
                PCWSTR(chosen.offset as usize as *const u16),
                point,
            )
        })?
    })
    .await?
}
