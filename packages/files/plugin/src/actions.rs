use std::cell::RefCell;
use std::path::Path;

use tauri::{AppHandle, WebviewWindow};
use windows::core::{Interface, HSTRING, PCSTR, PCWSTR, PSTR};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
use windows::Win32::System::Com::IDataObject;
use windows::Win32::System::Ole::{DROPEFFECT_COPY, DROPEFFECT_LINK, DROPEFFECT_MOVE};
use windows::Win32::UI::Shell::{
    BHID_DataObject, BHID_SFObject, BHID_SFUIObject, DefSubclassProc, IContextMenu, IContextMenu2,
    IContextMenu3, IShellFolder, RemoveWindowSubclass, SHDoDragDrop, SHEmptyRecycleBinW,
    SHMultiFileProperties, SHObjectProperties, SHOpenWithDialog, SetWindowSubclass,
    ShellExecuteExW, CMF_EXTENDEDVERBS, CMF_NORMAL, CMIC_MASK_PTINVOKE, CMINVOKECOMMANDINFO,
    CMINVOKECOMMANDINFOEX, GCS_VERBW, OAIF_ALLOW_REGISTRATION, OAIF_EXEC, OAIF_REGISTER_EXT,
    OPENASINFO, SEE_MASK_FLAG_NO_UI, SEE_MASK_IDLIST, SEE_MASK_NOASYNC, SEE_MASK_UNICODE,
    SHELLEXECUTEINFOW, SHOP_FILEPATH,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CreatePopupMenu, DestroyMenu, GetCursorPos, SetForegroundWindow, TrackPopupMenuEx,
    SW_SHOWNORMAL, TPM_RETURNCMD, TPM_RIGHTBUTTON, WM_DRAWITEM, WM_INITMENUPOPUP, WM_MEASUREITEM,
    WM_MENUCHAR,
};

use crate::address::describe;
use crate::com;
use crate::error::{Error, Result};

const FIRST_COMMAND: u32 = 1;
const LAST_COMMAND: u32 = 0x7FFF;
const SUBCLASS_ID: usize = 0xE515;

thread_local! {
    static ACTIVE: RefCell<Option<IContextMenu2>> = const { RefCell::new(None) };
}

pub fn shell_open(owner: isize, file: &str, parameters: &str, directory: Option<&str>) -> bool {
    let file = HSTRING::from(file);
    let parameters = HSTRING::from(parameters);
    let directory = directory.map(HSTRING::from);

    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOASYNC | SEE_MASK_FLAG_NO_UI,
        hwnd: com::owner(owner),
        lpFile: PCWSTR(file.as_ptr()),
        lpParameters: PCWSTR(parameters.as_ptr()),
        lpDirectory: directory
            .as_ref()
            .map_or(PCWSTR::null(), |dir| PCWSTR(dir.as_ptr())),
        nShow: SW_SHOWNORMAL.0,
        ..Default::default()
    };

    unsafe { ShellExecuteExW(&mut info) }.is_ok()
}

pub fn execute(owner: isize, key: &str) -> Result<()> {
    let _apartment = com::Apartment::enter();
    let list = com::pidl(key)?;
    let directory = (!key.starts_with("pidl:"))
        .then(|| {
            Path::new(key)
                .parent()
                .map(|parent| HSTRING::from(parent.as_os_str()))
        })
        .flatten();

    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_IDLIST | SEE_MASK_NOASYNC,
        hwnd: com::owner(owner),
        lpIDList: list.as_ptr() as *mut _,
        lpDirectory: directory
            .as_ref()
            .map_or(PCWSTR::null(), |dir| PCWSTR(dir.as_ptr())),
        nShow: SW_SHOWNORMAL.0,
        ..Default::default()
    };

    Ok(unsafe { ShellExecuteExW(&mut info) }?)
}

fn link_folder(key: &str) -> Option<String> {
    if !key.to_lowercase().ends_with(".lnk") {
        return None;
    }

    let target = com::link_target(key)?;

    com::is_folder(&target).then(|| describe(&target).path)
}

#[tauri::command]
pub async fn open_item(window: WebviewWindow, item: String) -> Result<Option<String>> {
    let owner = com::hwnd(&window);

    com::sta(move || match link_folder(&item) {
        Some(folder) => Ok(Some(folder)),
        None => execute(owner, &item).map(|_| None),
    })
    .await?
}

#[tauri::command]
pub async fn open_with(app: AppHandle, window: WebviewWindow, path: String) -> Result<()> {
    let owner = com::hwnd(&window);

    com::ui(&app, move || {
        let file = HSTRING::from(path);
        let info = OPENASINFO {
            pcszFile: PCWSTR(file.as_ptr()),
            pcszClass: PCWSTR::null(),
            oaifInFlags: OAIF_ALLOW_REGISTRATION | OAIF_REGISTER_EXT | OAIF_EXEC,
        };

        let _ = unsafe { SHOpenWithDialog(Some(com::owner(owner)), &info) };
    })
    .await
}

#[tauri::command]
pub async fn show_properties(
    app: AppHandle,
    window: WebviewWindow,
    items: Vec<String>,
) -> Result<()> {
    let owner = com::hwnd(&window);

    com::ui(&app, move || -> Result<()> {
        if let [single] = items.as_slice() {
            if Path::new(single).exists() {
                let shown = unsafe {
                    SHObjectProperties(
                        Some(com::owner(owner)),
                        SHOP_FILEPATH,
                        &HSTRING::from(single.as_str()),
                        PCWSTR::null(),
                    )
                };

                return Ok(shown.ok()?);
            }
        }

        let array = com::items(&items)?;
        let data: IDataObject = unsafe { array.BindToHandler(None, &BHID_DataObject) }?;

        Ok(unsafe { SHMultiFileProperties(&data, 0) }?)
    })
    .await?
}

#[tauri::command]
pub async fn start_drag(app: AppHandle, window: WebviewWindow, items: Vec<String>) -> Result<()> {
    let owner = com::hwnd(&window);

    com::ui(&app, move || -> Result<()> {
        let array = com::items(&items)?;
        let data: IDataObject = unsafe { array.BindToHandler(None, &BHID_DataObject) }?;

        unsafe {
            SHDoDragDrop(
                Some(com::owner(owner)),
                &data,
                None,
                DROPEFFECT_COPY | DROPEFFECT_MOVE | DROPEFFECT_LINK,
            )
        }?;

        Ok(())
    })
    .await?
}

#[tauri::command]
pub async fn empty_recycle_bin(window: WebviewWindow) -> Result<()> {
    let owner = com::hwnd(&window);

    com::sta(move || unsafe { SHEmptyRecycleBinW(Some(com::owner(owner)), PCWSTR::null(), 0) })
        .await??;

    Ok(())
}

unsafe extern "system" fn forward(
    hwnd: HWND,
    message: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _: usize,
    _: usize,
) -> LRESULT {
    let menu_message = matches!(
        message,
        WM_INITMENUPOPUP | WM_DRAWITEM | WM_MEASUREITEM | WM_MENUCHAR
    );

    if menu_message {
        let handled = ACTIVE.with(|slot| {
            let menu = slot.borrow().clone()?;

            if let Ok(rich) = menu.cast::<IContextMenu3>() {
                let mut result = LRESULT(0);

                return unsafe { rich.HandleMenuMsg2(message, wparam, lparam, Some(&mut result)) }
                    .ok()
                    .map(|_| result);
            }

            unsafe { menu.HandleMenuMsg(message, wparam, lparam) }
                .ok()
                .map(|_| LRESULT(0))
        });

        if let Some(result) = handled {
            return result;
        }
    }

    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

fn context_menu(owner: HWND, keys: &[String], folder: Option<&str>) -> Result<IContextMenu> {
    if keys.is_empty() {
        let item = com::item(folder.ok_or(Error::Missing)?)?;
        let parent: IShellFolder = unsafe { item.BindToHandler(None, &BHID_SFObject) }?;

        return Ok(unsafe { parent.CreateViewObject(owner) }?);
    }

    let array = com::items(keys)?;

    Ok(unsafe { array.BindToHandler(None, &BHID_SFUIObject) }?)
}

fn verb_of(menu: &IContextMenu, offset: u32) -> String {
    let mut buffer = [0u16; 128];

    let found = unsafe {
        menu.GetCommandString(
            offset as usize,
            GCS_VERBW,
            None,
            PSTR(buffer.as_mut_ptr() as *mut u8),
            buffer.len() as u32,
        )
    };

    if found.is_err() {
        return String::new();
    }

    com::wide(&buffer)
}

fn invoke(
    menu: &IContextMenu,
    owner: HWND,
    verb: PCSTR,
    verb_wide: PCWSTR,
    point: POINT,
) -> Result<()> {
    let info = CMINVOKECOMMANDINFOEX {
        cbSize: std::mem::size_of::<CMINVOKECOMMANDINFOEX>() as u32,
        fMask: SEE_MASK_UNICODE | CMIC_MASK_PTINVOKE,
        hwnd: owner,
        lpVerb: verb,
        lpVerbW: verb_wide,
        nShow: SW_SHOWNORMAL.0,
        ptInvoke: point,
        ..Default::default()
    };

    Ok(unsafe { menu.InvokeCommand(&info as *const _ as *const CMINVOKECOMMANDINFO) }?)
}

fn track(
    owner: isize,
    keys: Vec<String>,
    folder: Option<String>,
    extended: bool,
) -> Result<Option<String>> {
    let hwnd = com::owner(owner);
    let menu = context_menu(hwnd, &keys, folder.as_deref())?;
    let popup = unsafe { CreatePopupMenu() }?;
    let flags = if extended {
        CMF_NORMAL | CMF_EXTENDEDVERBS
    } else {
        CMF_NORMAL
    };

    let built = unsafe { menu.QueryContextMenu(popup, 0, FIRST_COMMAND, LAST_COMMAND, flags) };

    if built.is_err() {
        let _ = unsafe { DestroyMenu(popup) };

        return Err(Error::Os(built.message()));
    }

    let mut point = POINT::default();
    let _ = unsafe { GetCursorPos(&mut point) };

    ACTIVE.with(|slot| *slot.borrow_mut() = menu.cast::<IContextMenu2>().ok());

    let chosen = unsafe {
        let _ = SetWindowSubclass(hwnd, Some(forward), SUBCLASS_ID, 0);
        let _ = SetForegroundWindow(hwnd);
        let chosen = TrackPopupMenuEx(
            popup,
            (TPM_RETURNCMD | TPM_RIGHTBUTTON).0,
            point.x,
            point.y,
            hwnd,
            None,
        );
        let _ = RemoveWindowSubclass(hwnd, Some(forward), SUBCLASS_ID);

        chosen.0
    };

    ACTIVE.with(|slot| *slot.borrow_mut() = None);

    let result = if chosen > 0 {
        let offset = chosen as u32 - FIRST_COMMAND;
        let verb = verb_of(&menu, offset);

        if verb.eq_ignore_ascii_case("rename") {
            Ok(Some(verb))
        } else {
            invoke(
                &menu,
                hwnd,
                PCSTR(offset as usize as *const u8),
                PCWSTR(offset as usize as *const u16),
                point,
            )
            .map(|_| Some(verb))
        }
    } else {
        Ok(None)
    };

    let _ = unsafe { DestroyMenu(popup) };

    result
}

#[tauri::command]
pub async fn native_menu(
    app: AppHandle,
    window: WebviewWindow,
    items: Vec<String>,
    folder: Option<String>,
    extended: bool,
) -> Result<Option<String>> {
    let owner = com::hwnd(&window);

    com::ui(&app, move || track(owner, items, folder, extended)).await?
}

#[tauri::command]
pub async fn invoke_verb(
    app: AppHandle,
    window: WebviewWindow,
    items: Vec<String>,
    verb: String,
) -> Result<()> {
    let owner = com::hwnd(&window);

    com::ui(&app, move || {
        let hwnd = com::owner(owner);
        let menu = context_menu(hwnd, &items, None)?;
        let popup = unsafe { CreatePopupMenu() }?;

        let _ = unsafe { menu.QueryContextMenu(popup, 0, FIRST_COMMAND, LAST_COMMAND, CMF_NORMAL) };

        let narrow = format!("{verb}\0");
        let wide = HSTRING::from(verb.as_str());
        let mut point = POINT::default();
        let _ = unsafe { GetCursorPos(&mut point) };

        let result = invoke(
            &menu,
            hwnd,
            PCSTR(narrow.as_ptr()),
            PCWSTR(wide.as_ptr()),
            point,
        );

        let _ = unsafe { DestroyMenu(popup) };

        result
    })
    .await?
}
