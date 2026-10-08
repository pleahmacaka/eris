use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, RECT};
use windows::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
};
use windows::Win32::UI::WindowsAndMessaging::{EnumWindows, GetWindowRect, GetWindowTextW};
use windows::core::BOOL;
use winreg::RegKey;
use winreg::enums::HKEY_CURRENT_USER;

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

const CAPTURE_STORES: [&str; 2] = [
    r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\graphicsCaptureProgrammatic",
    r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\graphicsCaptureWithoutBorder",
];

// share bars are short strips and may be hidden; tall windows with these words are documents
const BAR_HEIGHT: i32 = 160;

fn process_names() -> Vec<String> {
    let Ok(snapshot) = (unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }) else {
        return Vec::new();
    };

    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    let mut names = Vec::new();
    let mut next = unsafe { Process32FirstW(snapshot, &mut entry) };

    while next.is_ok() {
        let length = entry
            .szExeFile
            .iter()
            .position(|&c| c == 0)
            .unwrap_or(entry.szExeFile.len());

        names.push(String::from_utf16_lossy(&entry.szExeFile[..length]).to_lowercase());
        next = unsafe { Process32NextW(snapshot, &mut entry) };
    }

    unsafe {
        let _ = CloseHandle(snapshot);
    }

    names
}

pub fn capture_process_running() -> bool {
    process_names()
        .iter()
        .any(|name| CAPTURE_PROCESSES.contains(&name.as_str()))
}

fn capturing(entry: &RegKey) -> bool {
    let start: u64 = entry.get_value("LastUsedTimeStart").unwrap_or(0);
    let stop: u64 = entry.get_value("LastUsedTimeStop").unwrap_or(1);

    start != 0 && stop == 0
}

// Windows logs each Graphics Capture session per app; a zero stop time means the capture is still live
pub fn capture_session_open() -> bool {
    let user = RegKey::predef(HKEY_CURRENT_USER);
    let mut running: Option<Vec<String>> = None;

    for store in CAPTURE_STORES {
        let Ok(store) = user.open_subkey(store) else {
            continue;
        };

        for name in store.enum_keys().flatten() {
            let Ok(entry) = store.open_subkey(&name) else {
                continue;
            };

            if name != "NonPackaged" {
                if capturing(&entry) {
                    return true;
                }

                continue;
            }

            for program in entry.enum_keys().flatten() {
                let live = entry
                    .open_subkey(&program)
                    .is_ok_and(|program| capturing(&program));
                // a crashed app never writes its stop time, so its program must still be running
                let exe = program
                    .rsplit('#')
                    .next()
                    .unwrap_or_default()
                    .to_lowercase();

                if live && running.get_or_insert_with(process_names).contains(&exe) {
                    return true;
                }
            }
        }
    }

    false
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
