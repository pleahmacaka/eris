use std::fmt::Write;

use tauri::AppHandle;
use tokio::sync::oneshot;
use windows::core::{Interface, HSTRING, PWSTR};
use windows::Win32::Foundation::HWND;
use windows::Win32::System::Com::{
    CoCreateInstance, CoInitializeEx, CoTaskMemAlloc, CoTaskMemFree, CoUninitialize, IPersistFile,
    CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, STGM_READ,
};
use windows::Win32::System::SystemServices::{SFGAO_FOLDER, SFGAO_STREAM};
use windows::Win32::UI::Shell::Common::ITEMIDLIST;
use windows::Win32::UI::Shell::{
    BHID_LinkTargetItem, ILGetSize, IShellItem, IShellItemArray, IShellLinkW,
    SHCreateItemFromIDList, SHCreateShellItemArrayFromIDLists, SHGetIDListFromObject,
    SHParseDisplayName, SHSimpleIDListFromPath, ShellLink, SIGDN,
};

use crate::error::{Error, Result};

pub struct Apartment(bool);

impl Apartment {
    pub fn enter() -> Self {
        Self(unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_ok())
    }
}

impl Drop for Apartment {
    fn drop(&mut self) {
        if self.0 {
            unsafe { CoUninitialize() };
        }
    }
}

pub fn blocking<T: Send + 'static>(work: impl FnOnce() -> T + Send + 'static) -> Result<T> {
    std::thread::spawn(move || {
        let _apartment = Apartment::enter();

        work()
    })
    .join()
    .map_err(|_| Error::Os("the operation stopped unexpectedly".into()))
}

pub async fn sta<T: Send + 'static>(work: impl FnOnce() -> T + Send + 'static) -> Result<T> {
    let (sender, receiver) = oneshot::channel();

    std::thread::spawn(move || {
        let _apartment = Apartment::enter();
        let _ = sender.send(work());
    });

    receiver
        .await
        .map_err(|_| Error::Os("the operation stopped unexpectedly".into()))
}

// menus, drags and property sheets need the owner window's thread and its message loop
pub async fn ui<T: Send + 'static>(
    app: &AppHandle,
    work: impl FnOnce() -> T + Send + 'static,
) -> Result<T> {
    let (sender, receiver) = oneshot::channel();

    app.run_on_main_thread(move || {
        let _ = sender.send(work());
    })?;

    receiver
        .await
        .map_err(|_| Error::Os("the operation stopped unexpectedly".into()))
}

pub fn wide(buffer: &[u16]) -> String {
    let end = buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len());

    String::from_utf16_lossy(&buffer[..end])
}

pub fn is_folder(item: &IShellItem) -> bool {
    let flags = unsafe { item.GetAttributes(SFGAO_FOLDER | SFGAO_STREAM) }.unwrap_or_default();

    flags.0 & SFGAO_FOLDER.0 != 0 && flags.0 & SFGAO_STREAM.0 == 0
}

pub fn link_target(key: &str) -> Option<IShellItem> {
    let link = item(key).ok()?;

    unsafe { link.BindToHandler(None, &BHID_LinkTargetItem) }.ok()
}

// binding the target item reaches the share and stalls until SMB gives up; the stored ID list does not
pub fn stored_link_target(path: &str) -> Option<IShellItem> {
    let link: IShellLinkW =
        unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER) }.ok()?;

    unsafe {
        link.cast::<IPersistFile>()
            .ok()?
            .Load(&HSTRING::from(path), STGM_READ)
    }
    .ok()?;

    Pidl(unsafe { link.GetIDList() }.ok()?).item().ok()
}

pub fn take(raw: PWSTR) -> String {
    let text = unsafe { raw.to_string() }.unwrap_or_default();

    unsafe { CoTaskMemFree(Some(raw.0 as _)) };

    text
}

pub fn display(item: &IShellItem, kind: SIGDN) -> String {
    unsafe { item.GetDisplayName(kind) }
        .map(take)
        .unwrap_or_default()
}

pub fn hwnd(window: &tauri::WebviewWindow) -> isize {
    window
        .hwnd()
        .map(|handle| handle.0 as isize)
        .unwrap_or_default()
}

pub fn owner(raw: isize) -> HWND {
    HWND(raw as _)
}

pub struct Pidl(*mut ITEMIDLIST);

impl Pidl {
    pub fn as_ptr(&self) -> *const ITEMIDLIST {
        self.0
    }

    pub fn item(&self) -> Result<IShellItem> {
        Ok(unsafe { SHCreateItemFromIDList(self.0) }?)
    }
}

impl Drop for Pidl {
    fn drop(&mut self) {
        unsafe { CoTaskMemFree(Some(self.0 as _)) };
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .fold(String::with_capacity(bytes.len() * 2), |mut out, byte| {
            let _ = write!(out, "{byte:02x}");
            out
        })
}

fn unhex(text: &str) -> Option<Vec<u8>> {
    if !text.len().is_multiple_of(2) {
        return None;
    }

    (0..text.len())
        .step_by(2)
        .map(|at| u8::from_str_radix(text.get(at..at + 2)?, 16).ok())
        .collect()
}

fn well_formed(bytes: &[u8]) -> bool {
    let mut at = 0;

    while at + 2 <= bytes.len() {
        let size = u16::from_le_bytes([bytes[at], bytes[at + 1]]) as usize;

        if size == 0 {
            return at + 2 == bytes.len();
        }

        if size < 2 {
            return false;
        }

        at += size;
    }

    false
}

fn from_bytes(bytes: &[u8]) -> Result<Pidl> {
    if !well_formed(bytes) {
        return Err(Error::Invalid);
    }

    let memory = unsafe { CoTaskMemAlloc(bytes.len()) } as *mut u8;

    if memory.is_null() {
        return Err(Error::Os("out of memory".into()));
    }

    unsafe { std::ptr::copy_nonoverlapping(bytes.as_ptr(), memory, bytes.len()) };

    Ok(Pidl(memory as *mut ITEMIDLIST))
}

pub fn pidl(key: &str) -> Result<Pidl> {
    if let Some(text) = key.strip_prefix("pidl:") {
        return from_bytes(&unhex(text).ok_or(Error::Invalid)?);
    }

    let mut raw = std::ptr::null_mut();

    unsafe { SHParseDisplayName(&HSTRING::from(key), None, &mut raw, 0, None) }?;

    Ok(Pidl(raw))
}

pub fn item(key: &str) -> Result<IShellItem> {
    pidl(key)?.item()
}

// a simple pidl resolves by name alone, so a file that only exists inside an archive still gets its type icon
pub fn named_item(path: &str) -> Result<IShellItem> {
    let raw = unsafe { SHSimpleIDListFromPath(&HSTRING::from(path)) };

    if raw.is_null() {
        return Err(Error::Missing);
    }

    Pidl(raw).item()
}

pub fn items(keys: &[String]) -> Result<IShellItemArray> {
    let lists = keys
        .iter()
        .map(|key| pidl(key))
        .collect::<Result<Vec<_>>>()?;

    let pointers: Vec<*const ITEMIDLIST> = lists.iter().map(Pidl::as_ptr).collect();

    Ok(unsafe { SHCreateShellItemArrayFromIDLists(&pointers) }?)
}

pub fn key_of(item: &IShellItem) -> Option<String> {
    let raw = unsafe { SHGetIDListFromObject(item) }.ok()?;
    let size = unsafe { ILGetSize(Some(raw)) } as usize;
    let bytes = unsafe { std::slice::from_raw_parts(raw as *const u8, size) };
    let key = format!("pidl:{}", hex(bytes));

    unsafe { CoTaskMemFree(Some(raw as _)) };

    Some(key)
}
