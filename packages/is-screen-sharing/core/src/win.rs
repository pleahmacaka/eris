use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, RECT};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
};
use windows::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowRect, GetWindowTextW};
use windows::core::BOOL;

const CAPTURE_PROCESSES: [&str; 1] = ["cpthost.exe"];

const SHARE_PHRASES: [&str; 12] = [
    "is sharing your screen",
    "is sharing a window",
    "is sharing this tab",
    "is sharing a tab",
    "sharing control bar",
    "화면을 공유",
    "창을 공유",
    "탭을 공유",
    "画面を共有",
    "ウィンドウを共有",
    "タブを共有",
    "正在共享",
];

// share bars are short strips and may be hidden; tall windows with these words are documents
const BAR_HEIGHT: i32 = 160;

pub fn capture_process_running() -> bool {
    let Ok(snapshot) = (unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }) else {
        return false;
    };

    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    let mut found = false;
    let mut next = unsafe { Process32FirstW(snapshot, &mut entry) };

    while next.is_ok() {
        let length = entry
            .szExeFile
            .iter()
            .position(|&c| c == 0)
            .unwrap_or(entry.szExeFile.len());
        let name = String::from_utf16_lossy(&entry.szExeFile[..length]).to_lowercase();

        if CAPTURE_PROCESSES.contains(&name.as_str()) {
            found = true;
            break;
        }

        next = unsafe { Process32NextW(snapshot, &mut entry) };
    }

    unsafe {
        let _ = CloseHandle(snapshot);
    }

    found
}

unsafe extern "system" fn inspect(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let found = unsafe { &mut *(lparam.0 as *mut bool) };
    let mut rect = RECT::default();

    if unsafe { GetWindowRect(hwnd, &mut rect) }.is_err() || rect.bottom - rect.top > BAR_HEIGHT {
        return BOOL(1);
    }

    let mut buffer = [0u16; 256];
    let length = unsafe { GetWindowTextW(hwnd, &mut buffer) }.max(0) as usize;
    let title = String::from_utf16_lossy(&buffer[..length]).to_lowercase();

    if SHARE_PHRASES.iter().any(|phrase| title.contains(phrase)) {
        *found = true;

        return BOOL(0);
    }

    BOOL(1)
}

pub fn share_bar_open() -> bool {
    let mut found = false;

    unsafe {
        let _ = EnumWindows(Some(inspect), LPARAM(&mut found as *mut bool as isize));
    }

    found
}
