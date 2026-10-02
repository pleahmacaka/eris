use std::path::{Path, PathBuf};

use tauri::WebviewWindow;
use windows::core::{w, HSTRING, PCWSTR};
use windows::Win32::Foundation::{HANDLE, HGLOBAL, POINT};
use windows::Win32::Storage::FileSystem::FILE_ATTRIBUTE_DIRECTORY;
use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardData, IsClipboardFormatAvailable, OpenClipboard,
    RegisterClipboardFormatW, SetClipboardData,
};
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
use windows::Win32::UI::Shell::{
    DragQueryFileW, FileOperation, IFileOperation, IFileOperationProgressSink, DROPFILES,
    FILEOPERATION_FLAGS, FOFX_ADDUNDORECORD, FOFX_RECYCLEONDELETE, FOF_ALLOWUNDO,
    FOF_NOCONFIRMATION, FOF_NOCONFIRMMKDIR, FOF_NOERRORUI, FOF_RENAMEONCOLLISION, FOF_SILENT,
    FOF_WANTNUKEWARNING, HDROP,
};

use crate::error::{Error, Result};
use crate::{com, places};

const CF_HDROP: u32 = 15;

fn operate(
    owner: isize,
    flags: FILEOPERATION_FLAGS,
    plan: impl FnOnce(&IFileOperation) -> windows::core::Result<()>,
) -> Result<()> {
    let operation: IFileOperation = unsafe { CoCreateInstance(&FileOperation, None, CLSCTX_ALL) }?;

    unsafe { operation.SetOwnerWindow(com::owner(owner)) }?;
    unsafe { operation.SetOperationFlags(flags) }?;

    plan(&operation)?;

    let performed = unsafe { operation.PerformOperations() };

    let aborted = unsafe { operation.GetAnyOperationsAborted() }
        .map(|flag| flag.as_bool())
        .unwrap_or(false);

    if aborted {
        return Err(Error::Cancelled);
    }

    Ok(performed?)
}

fn folder_key(path: &str) -> String {
    path.trim_end_matches('\\').to_lowercase()
}

fn parent_key(path: &str) -> Option<String> {
    Path::new(path)
        .parent()
        .map(|parent| folder_key(&parent.to_string_lossy()))
}

fn transfer(owner: isize, items: Vec<String>, target: &str, cut: bool) -> Result<()> {
    let destination = folder_key(target);

    let items: Vec<String> = if cut {
        items
            .into_iter()
            .filter(|item| parent_key(item).as_deref() != Some(destination.as_str()))
            .collect()
    } else {
        items
    };

    if items.is_empty() {
        return Ok(());
    }

    let mut flags = FOF_ALLOWUNDO | FOFX_ADDUNDORECORD | FOF_NOCONFIRMMKDIR;

    if !cut
        && items
            .iter()
            .any(|item| parent_key(item).as_deref() == Some(destination.as_str()))
    {
        flags |= FOF_RENAMEONCOLLISION;
    }

    let sources = com::items(&items)?;
    let folder = com::item(target)?;

    operate(owner, flags, |operation| unsafe {
        if cut {
            operation.MoveItems(&sources, &folder)
        } else {
            operation.CopyItems(&sources, &folder)
        }
    })
}

#[tauri::command]
pub async fn transfer_items(
    window: WebviewWindow,
    items: Vec<String>,
    target: String,
    cut: bool,
) -> Result<()> {
    let owner = com::hwnd(&window);

    com::sta(move || transfer(owner, items, &target, cut)).await?
}

pub fn recycle(items: Vec<String>) -> Result<()> {
    let flags =
        FOF_ALLOWUNDO | FOFX_RECYCLEONDELETE | FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI;

    com::blocking(move || {
        let targets = com::items(&items)?;

        operate(0, flags, |operation| unsafe {
            operation.DeleteItems(&targets)
        })
    })?
}

fn delete(owner: isize, items: Vec<String>, permanent: bool) -> Result<()> {
    let flags = if permanent {
        FILEOPERATION_FLAGS(0)
    } else if places::confirm_recycle() {
        FOF_ALLOWUNDO | FOFX_RECYCLEONDELETE | FOFX_ADDUNDORECORD | FOF_WANTNUKEWARNING
    } else {
        FOF_ALLOWUNDO
            | FOFX_RECYCLEONDELETE
            | FOFX_ADDUNDORECORD
            | FOF_WANTNUKEWARNING
            | FOF_NOCONFIRMATION
    };

    let targets = com::items(&items)?;

    operate(owner, flags, |operation| unsafe {
        operation.DeleteItems(&targets)
    })
}

#[tauri::command]
pub async fn delete_items(
    window: WebviewWindow,
    items: Vec<String>,
    permanent: bool,
) -> Result<()> {
    if items.is_empty() {
        return Ok(());
    }

    let owner = com::hwnd(&window);

    com::sta(move || delete(owner, items, permanent)).await?
}

#[tauri::command]
pub async fn rename_item(window: WebviewWindow, item: String, name: String) -> Result<()> {
    let owner = com::hwnd(&window);

    com::sta(move || {
        let target = com::item(&item)?;

        operate(
            owner,
            FOF_ALLOWUNDO | FOFX_ADDUNDORECORD,
            |operation| unsafe {
                operation.RenameItem(
                    &target,
                    &HSTRING::from(name),
                    None::<&IFileOperationProgressSink>,
                )
            },
        )
    })
    .await?
}

fn free_name(parent: &Path, name: &str) -> String {
    (1..)
        .map(|attempt| match attempt {
            1 => name.to_string(),
            n => format!("{name} ({n})"),
        })
        .find(|candidate| !parent.join(candidate).exists())
        .unwrap_or_else(|| name.to_string())
}

fn create_folder(owner: isize, parent: String, name: String) -> Result<String> {
    let base = PathBuf::from(&parent);
    let chosen = free_name(&base, &name);
    let created = base.join(&chosen).to_string_lossy().to_string();
    let folder = com::item(&parent)?;

    operate(
        owner,
        FOF_ALLOWUNDO | FOFX_ADDUNDORECORD | FOF_SILENT,
        |operation| unsafe {
            operation.NewItem(
                &folder,
                FILE_ATTRIBUTE_DIRECTORY.0,
                &HSTRING::from(chosen),
                PCWSTR::null(),
                None::<&IFileOperationProgressSink>,
            )
        },
    )?;

    Ok(created)
}

#[tauri::command]
pub async fn new_folder(window: WebviewWindow, parent: String, name: String) -> Result<String> {
    let owner = com::hwnd(&window);

    com::sta(move || create_folder(owner, parent, name)).await?
}

fn drop_effect() -> u32 {
    unsafe { RegisterClipboardFormatW(w!("Preferred DropEffect")) }
}

fn write_clipboard(paths: &[String], cut: bool) -> Result<()> {
    unsafe {
        OpenClipboard(None)?;

        let result = (|| -> Result<()> {
            EmptyClipboard()?;

            let mut wide: Vec<u16> = Vec::new();

            for path in paths {
                wide.extend(path.encode_utf16());
                wide.push(0);
            }

            wide.push(0);

            let bytes = std::mem::size_of::<DROPFILES>() + wide.len() * 2;
            let list = GlobalAlloc(GMEM_MOVEABLE, bytes)?;
            let head = GlobalLock(list) as *mut DROPFILES;

            if head.is_null() {
                return Err(Error::NotReady);
            }

            (*head).pFiles = std::mem::size_of::<DROPFILES>() as u32;
            (*head).pt = POINT { x: 0, y: 0 };
            (*head).fNC = false.into();
            (*head).fWide = true.into();

            std::ptr::copy_nonoverlapping(wide.as_ptr(), head.add(1) as *mut u16, wide.len());

            let _ = GlobalUnlock(list);

            SetClipboardData(CF_HDROP, Some(HANDLE(list.0)))?;

            let effect = GlobalAlloc(GMEM_MOVEABLE, 4)?;
            let slot = GlobalLock(effect) as *mut u32;

            if slot.is_null() {
                return Err(Error::NotReady);
            }

            *slot = if cut { 2 } else { 1 };

            let _ = GlobalUnlock(effect);

            SetClipboardData(drop_effect(), Some(HANDLE(effect.0)))?;

            Ok(())
        })();

        let _ = CloseClipboard();

        result
    }
}

fn read_clipboard() -> Option<(Vec<String>, bool)> {
    unsafe {
        OpenClipboard(None).ok()?;

        let result = (|| {
            let handle = GetClipboardData(CF_HDROP).ok()?;
            let drop = HDROP(handle.0);
            let count = DragQueryFileW(drop, u32::MAX, None);
            let mut paths = Vec::with_capacity(count as usize);

            for index in 0..count {
                let len = DragQueryFileW(drop, index, None) as usize;
                let mut buffer = vec![0u16; len + 1];

                DragQueryFileW(drop, index, Some(&mut buffer));
                paths.push(String::from_utf16_lossy(&buffer[..len]));
            }

            let cut = GetClipboardData(drop_effect())
                .ok()
                .and_then(|handle| {
                    let memory = HGLOBAL(handle.0);
                    let data = GlobalLock(memory) as *const u32;
                    let value = (!data.is_null()).then(|| data.read_unaligned());
                    let _ = GlobalUnlock(memory);
                    value
                })
                .is_some_and(|effect| effect & 2 == 2);

            Some((paths, cut))
        })();

        let _ = CloseClipboard();

        result
    }
}

#[tauri::command]
pub fn set_clipboard(items: Vec<String>, cut: bool) -> Result<()> {
    write_clipboard(&items, cut)
}

#[tauri::command]
pub fn clipboard_has_files() -> bool {
    unsafe { IsClipboardFormatAvailable(CF_HDROP) }.is_ok()
}

fn paste(owner: isize, target: String) -> Result<Vec<String>> {
    let Some((paths, cut)) = read_clipboard() else {
        return Ok(Vec::new());
    };

    let landed = paths
        .iter()
        .filter_map(|path| Path::new(path).file_name())
        .map(|name| Path::new(&target).join(name).to_string_lossy().to_string())
        .collect();

    transfer(owner, paths, &target, cut)?;

    if cut {
        unsafe {
            if OpenClipboard(None).is_ok() {
                let _ = EmptyClipboard();
                let _ = CloseClipboard();
            }
        }
    }

    Ok(landed)
}

#[tauri::command]
pub async fn paste_items(window: WebviewWindow, target: String) -> Result<Vec<String>> {
    let owner = com::hwnd(&window);

    com::sta(move || paste(owner, target)).await?
}
