use serde::Serialize;
use tauri::WebviewWindow;

#[derive(Serialize)]
pub struct WindowEntry {
    pub hwnd: isize,
    pub title: String,
    pub process: String,
    pub pid: u32,
    pub minimized: bool,
}

#[tauri::command(async)]
pub fn list_windows() -> Vec<WindowEntry> {
    win::list()
}

#[tauri::command(async)]
pub fn activate_window(hwnd: isize) {
    win::activate(hwnd);
}

#[tauri::command]
pub fn close_window(hwnd: isize) {
    win::close(hwnd);
}

#[cfg(target_os = "windows")]
pub fn force_foreground(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        win::force_foreground(hwnd.0 as isize);
    }
}

#[cfg(not(target_os = "windows"))]
pub fn force_foreground(_window: &WebviewWindow) {}

#[cfg(target_os = "windows")]
mod win {
    use windows::core::{BOOL, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, WPARAM};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows::Win32::System::Threading::{
        AttachThreadInput, GetCurrentProcessId, GetCurrentThreadId, OpenProcess,
        QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{SetFocus, VK_MENU};
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, EnumWindows, GetClassNameW, GetForegroundWindow, GetWindowLongPtrW,
        GetWindowTextW, GetWindowThreadProcessId, IsHungAppWindow, IsIconic, IsWindowVisible,
        PostMessageW, SetForegroundWindow, ShowWindowAsync, GWL_EXSTYLE, SW_RESTORE, WM_CLOSE,
        WS_EX_TOOLWINDOW,
    };

    use super::WindowEntry;

    const HIDDEN_CLASSES: [&str; 2] = ["Progman", "Windows.UI.Core.CoreWindow"];

    fn read(hwnd: HWND, reader: unsafe fn(HWND, &mut [u16]) -> i32) -> String {
        let mut buffer = [0u16; 512];
        let length = unsafe { reader(hwnd, &mut buffer) }.max(0) as usize;

        String::from_utf16_lossy(&buffer[..length])
    }

    fn process_path(pid: u32) -> String {
        let Ok(process) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) })
        else {
            return String::new();
        };

        let mut buffer = [0u16; 1024];
        let mut length = buffer.len() as u32;

        let query = unsafe {
            QueryFullProcessImageNameW(
                process,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &mut length,
            )
        };

        unsafe {
            let _ = CloseHandle(process);
        }

        match query {
            Ok(()) => String::from_utf16_lossy(&buffer[..length as usize]),
            Err(_) => String::new(),
        }
    }

    fn describe(hwnd: HWND) -> Option<WindowEntry> {
        unsafe {
            if !IsWindowVisible(hwnd).as_bool() {
                return None;
            }

            if GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32 & WS_EX_TOOLWINDOW.0 != 0 {
                return None;
            }

            let mut cloaked = 0u32;
            let _ = DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut cloaked as *mut _ as *mut _,
                std::mem::size_of::<u32>() as u32,
            );

            if cloaked != 0 {
                return None;
            }

            let title = read(hwnd, GetWindowTextW);

            if title.is_empty() || HIDDEN_CLASSES.contains(&read(hwnd, GetClassNameW).as_str()) {
                return None;
            }

            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));

            if pid == GetCurrentProcessId() {
                return None;
            }

            Some(WindowEntry {
                hwnd: hwnd.0 as isize,
                title,
                process: process_path(pid),
                pid,
                minimized: IsIconic(hwnd).as_bool(),
            })
        }
    }

    unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let entries = unsafe { &mut *(lparam.0 as *mut Vec<WindowEntry>) };

        if let Some(entry) = describe(hwnd) {
            entries.push(entry);
        }

        BOOL(1)
    }

    pub fn list() -> Vec<WindowEntry> {
        let mut entries: Vec<WindowEntry> = Vec::new();

        unsafe {
            let _ = EnumWindows(Some(collect), LPARAM(&mut entries as *mut _ as isize));
        }

        entries
    }

    pub fn activate(raw: isize) {
        let hwnd = HWND(raw as _);

        unsafe {
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindowAsync(hwnd, SW_RESTORE);
            }
        }

        force_foreground(raw);
    }

    pub fn close(raw: isize) {
        unsafe {
            let _ = PostMessageW(Some(HWND(raw as _)), WM_CLOSE, WPARAM(0), LPARAM(0));
        }
    }

    pub fn force_foreground(raw: isize) {
        let hwnd = HWND(raw as _);

        unsafe {
            let me = GetCurrentThreadId();
            let front_window = GetForegroundWindow();
            let front = GetWindowThreadProcessId(front_window, None);
            let attached = front != 0
                && front != me
                && !IsHungAppWindow(front_window).as_bool()
                && AttachThreadInput(me, front, true).as_bool();

            let _ = BringWindowToTop(hwnd);
            let raised = SetForegroundWindow(hwnd).as_bool();
            let _ = SetFocus(Some(hwnd));

            if attached {
                let _ = AttachThreadInput(me, front, false);
            }

            if !raised {
                crate::winkey::tap(VK_MENU);
                let _ = SetForegroundWindow(hwnd);
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::WindowEntry;

    pub fn list() -> Vec<WindowEntry> {
        Vec::new()
    }

    pub fn activate(_hwnd: isize) {}

    pub fn close(_hwnd: isize) {}
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    #[test]
    fn lists_visible_windows() {
        let windows = super::list_windows();

        assert!(!windows.is_empty(), "no top-level windows found");
        assert!(windows.iter().all(|entry| !entry.title.is_empty()));
    }
}
