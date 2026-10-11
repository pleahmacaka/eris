use windows::core::w;
use windows::Win32::Foundation::{HANDLE, HGLOBAL, POINT};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, GetClipboardData, GetClipboardSequenceNumber,
    IsClipboardFormatAvailable, OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
};
use windows::Win32::System::Memory::{
    GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE,
};
use windows::Win32::System::Threading::GetCurrentProcessId;
use windows::Win32::UI::Input::KeyboardAndMouse::{VK_CONTROL, VK_V};
use windows::Win32::UI::Shell::{DragQueryFileW, DROPFILES, HDROP};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

use super::ClipboardFiles;

pub fn sequence() -> u32 {
    unsafe { GetClipboardSequenceNumber() }
}

pub fn excluded() -> bool {
    unsafe {
        let monitor = RegisterClipboardFormatW(w!("ExcludeClipboardContentFromMonitorProcessing"));
        let history = RegisterClipboardFormatW(w!("CanIncludeInClipboardHistory"));

        if IsClipboardFormatAvailable(monitor).is_ok() {
            return true;
        }

        if IsClipboardFormatAvailable(history).is_err() {
            return false;
        }

        history_flag(history).is_none_or(|flag| flag == 0)
    }
}

unsafe fn history_flag(format: u32) -> Option<u32> {
    unsafe { OpenClipboard(None) }.ok()?;

    let flag = unsafe { GetClipboardData(format) }.ok().and_then(|handle| {
        let memory = HGLOBAL(handle.0);
        let data = unsafe { GlobalLock(memory) } as *const u32;

        let value = (!data.is_null() && unsafe { GlobalSize(memory) } >= 4)
            .then(|| unsafe { data.read_unaligned() });

        let _ = unsafe { GlobalUnlock(memory) };

        value
    });

    let _ = unsafe { CloseClipboard() };

    flag
}

pub fn foreign_foreground() -> bool {
    let front = unsafe { GetForegroundWindow() };

    if front.is_invalid() {
        return false;
    }

    let mut pid = 0u32;

    unsafe { GetWindowThreadProcessId(front, Some(&mut pid)) };

    pid != unsafe { GetCurrentProcessId() }
}

pub fn paste() {
    crate::shell::winkey::chord(&[VK_CONTROL, VK_V]);
}

const CF_HDROP: u32 = 15;

fn drop_effect() -> u32 {
    unsafe { RegisterClipboardFormatW(w!("Preferred DropEffect")) }
}

pub fn write_files(paths: &[String], cut: bool) -> Result<(), String> {
    unsafe {
        OpenClipboard(None).map_err(|e| e.to_string())?;

        let result = (|| -> Result<(), String> {
            EmptyClipboard().map_err(|e| e.to_string())?;

            let mut wide: Vec<u16> = Vec::new();

            for path in paths {
                wide.extend(path.encode_utf16());
                wide.push(0);
            }

            wide.push(0);

            let bytes = std::mem::size_of::<DROPFILES>() + wide.len() * 2;
            let list = GlobalAlloc(GMEM_MOVEABLE, bytes).map_err(|e| e.to_string())?;
            let head = GlobalLock(list) as *mut DROPFILES;

            if head.is_null() {
                return Err("GlobalLock failed".into());
            }

            (*head).pFiles = std::mem::size_of::<DROPFILES>() as u32;
            (*head).pt = POINT { x: 0, y: 0 };
            (*head).fNC = false.into();
            (*head).fWide = true.into();

            std::ptr::copy_nonoverlapping(wide.as_ptr(), head.add(1) as *mut u16, wide.len());

            let _ = GlobalUnlock(list);

            SetClipboardData(CF_HDROP, Some(HANDLE(list.0))).map_err(|e| e.to_string())?;

            let effect = GlobalAlloc(GMEM_MOVEABLE, 4).map_err(|e| e.to_string())?;
            let slot = GlobalLock(effect) as *mut u32;

            if slot.is_null() {
                return Err("GlobalLock failed".into());
            }

            *slot = if cut { 2 } else { 1 };

            let _ = GlobalUnlock(effect);

            SetClipboardData(drop_effect(), Some(HANDLE(effect.0))).map_err(|e| e.to_string())?;

            Ok(())
        })();

        let _ = CloseClipboard();

        result
    }
}

pub fn read_files() -> Option<ClipboardFiles> {
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

            Some(ClipboardFiles { paths, cut })
        })();

        let _ = CloseClipboard();

        result
    }
}

pub fn has_files() -> bool {
    unsafe { IsClipboardFormatAvailable(CF_HDROP).is_ok() }
}
