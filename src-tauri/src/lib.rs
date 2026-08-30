use std::path::PathBuf;

use serde::Serialize;
use tauri::{Manager, WindowEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg(target_os = "windows")]
mod appbar {
    use tauri::WebviewWindow;
    use windows::core::w;
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::UI::Shell::{
        SHAppBarMessage, ABE_BOTTOM, ABM_NEW, ABM_QUERYPOS, ABM_REMOVE, ABM_SETPOS, APPBARDATA,
    };
    use windows::Win32::UI::WindowsAndMessaging::{FindWindowW, ShowWindow, SW_HIDE, SW_SHOW};

    const CALLBACK_MESSAGE: u32 = 0x8000 + 1;

    static KEEP_HIDDEN: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

    fn handle(window: &WebviewWindow) -> tauri::Result<HWND> {
        Ok(HWND(window.hwnd()?.0 as _))
    }

    fn payload(hwnd: HWND) -> APPBARDATA {
        APPBARDATA {
            cbSize: std::mem::size_of::<APPBARDATA>() as u32,
            hWnd: hwnd,
            uCallbackMessage: CALLBACK_MESSAGE,
            uEdge: ABE_BOTTOM,
            ..Default::default()
        }
    }

    pub fn set_system_taskbar_visible(visible: bool) {
        let command = if visible { SW_SHOW } else { SW_HIDE };

        for class in [w!("Shell_TrayWnd"), w!("Shell_SecondaryTrayWnd")] {
            unsafe {
                if let Ok(hwnd) = FindWindowW(class, None) {
                    let _ = ShowWindow(hwnd, command);
                }
            }
        }
    }

    // ponytail: explorer re-shows the tray on its own events, so poll instead of hiding once
    pub fn keep_system_taskbar_hidden(hidden: bool) {
        use std::sync::atomic::Ordering;

        if !hidden {
            KEEP_HIDDEN.store(false, Ordering::Relaxed);
            set_system_taskbar_visible(true);

            return;
        }

        if KEEP_HIDDEN.swap(true, Ordering::Relaxed) {
            return;
        }

        std::thread::spawn(|| {
            while KEEP_HIDDEN.load(Ordering::Relaxed) {
                set_system_taskbar_visible(false);
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
        });
    }

    pub fn reserve_bottom_edge(window: &WebviewWindow, floating: bool) -> tauri::Result<()> {
        let hwnd = handle(window)?;
        let size = window.outer_size()?;
        let Some(monitor) = window.primary_monitor()? else {
            return Ok(());
        };

        let scale = monitor.scale_factor();
        let work = monitor.work_area();
        let screen = monitor.size();
        let margin = if floating { (12.0 * scale) as i32 } else { 0 };
        let band = size.height as i32 + margin * 2;
        let mut data = payload(hwnd);

        unsafe {
            SHAppBarMessage(ABM_NEW, &mut data);
        }

        data.rc = RECT {
            left: 0,
            top: screen.height as i32 - band,
            right: screen.width as i32,
            bottom: screen.height as i32,
        };

        unsafe {
            SHAppBarMessage(ABM_QUERYPOS, &mut data);
        }

        data.rc.top = data.rc.bottom - band;

        unsafe {
            SHAppBarMessage(ABM_SETPOS, &mut data);
        }

        let width = if floating {
            size.width as i32
        } else {
            data.rc.right - data.rc.left
        };

        let left = if floating {
            work.position.x + (work.size.width as i32 - width) / 2
        } else {
            data.rc.left
        };

        window.set_position(tauri::PhysicalPosition::new(
            left,
            data.rc.bottom - margin - size.height as i32,
        ))?;
        window.set_size(tauri::PhysicalSize::new(width as u32, size.height))?;

        Ok(())
    }

    pub fn release(window: &WebviewWindow) {
        if let Ok(hwnd) = handle(window) {
            let mut data = payload(hwnd);

            unsafe {
                SHAppBarMessage(ABM_REMOVE, &mut data);
            }
        }

        keep_system_taskbar_hidden(false);
    }
}

pub fn trace(message: &str) {
    use std::io::Write;

    let path = std::env::temp_dir().join("eris-hook.log");

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_millis())
        .unwrap_or_default();

    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{stamp} {message}");
    }
}

#[derive(Serialize)]
pub struct AppEntry {
    name: String,
    pub path: String,
}

fn shortcuts_in(root: PathBuf) -> Vec<AppEntry> {
    let mut entries = Vec::new();

    for entry in walkdir::WalkDir::new(root).into_iter().filter_map(Result::ok) {
        let path = entry.path();
        let is_shortcut = path
            .extension()
            .and_then(|ext| ext.to_str())
            .is_some_and(|ext| ext.eq_ignore_ascii_case("lnk") || ext.eq_ignore_ascii_case("url"));

        if !is_shortcut {
            continue;
        }

        let Some(name) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };

        entries.push(AppEntry {
            name: name.to_string(),
            path: path.to_string_lossy().into_owned(),
        });
    }

    entries
}

#[tauri::command]
fn pinned_apps() -> Vec<AppEntry> {
    let Some(appdata) = std::env::var_os("APPDATA") else {
        return Vec::new();
    };

    let mut entries = shortcuts_in(
        PathBuf::from(appdata)
            .join("Microsoft")
            .join("Internet Explorer")
            .join("Quick Launch")
            .join("User Pinned")
            .join("TaskBar"),
    );

    entries.sort_by_key(|entry| entry.name.to_lowercase());

    entries
}

fn start_menu_roots() -> Vec<PathBuf> {
    ["ProgramData", "APPDATA"]
        .iter()
        .filter_map(std::env::var_os)
        .map(|base| {
            PathBuf::from(base)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs")
        })
        .filter(|path| path.is_dir())
        .collect()
}

#[tauri::command]
fn list_apps() -> Vec<AppEntry> {
    let mut seen = std::collections::HashSet::new();
    let mut entries: Vec<AppEntry> = start_menu_roots()
        .into_iter()
        .flat_map(shortcuts_in)
        .filter(|entry| seen.insert(entry.name.to_lowercase()))
        .collect();

    entries.sort_by_key(|entry| entry.name.to_lowercase());

    entries
}

#[cfg(target_os = "windows")]
mod winshell {
    use base64::Engine;
    use windows::core::{Interface, HSTRING};
    use windows::Win32::Graphics::Gdi::{
        DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::UI::Shell::{ShellExecuteW, SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, HICON, ICONINFO, SW_SHOWNORMAL};

    pub fn launch(path: &str) -> Result<(), String> {
        let file = HSTRING::from(path);
        let verb = HSTRING::from("open");

        let result = unsafe { ShellExecuteW(None, &verb, &file, None, None, SW_SHOWNORMAL) };

        if result.0 as isize > 32 {
            Ok(())
        } else {
            Err(format!("ShellExecuteW failed with code {}", result.0 as isize))
        }
    }

    fn shortcut_target(path: &str) -> Option<String> {
        use windows::Win32::System::Com::{
            CoCreateInstance, CoInitializeEx, IPersistFile, CLSCTX_INPROC_SERVER,
            COINIT_APARTMENTTHREADED, STGM_READ,
        };
        use windows::Win32::UI::Shell::{IShellLinkW, ShellLink, SLGP_RAWPATH};

        if !path.to_lowercase().ends_with(".lnk") {
            return None;
        }

        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
            let file: IPersistFile = link.cast().ok()?;

            file.Load(&HSTRING::from(path), STGM_READ).ok()?;

            let mut buffer = [0u16; 260];

            link.GetPath(&mut buffer, std::ptr::null_mut(), SLGP_RAWPATH.0 as u32)
                .ok()?;

            let target = String::from_utf16_lossy(&buffer)
                .trim_end_matches(char::from(0))
                .to_string();

            (!target.is_empty() && std::path::Path::new(&target).exists()).then_some(target)
        }
    }

    fn icon_handle(path: &str) -> Option<HICON> {
        let mut info = SHFILEINFOW::default();

        let ok = unsafe {
            SHGetFileInfoW(
                &HSTRING::from(path),
                Default::default(),
                Some(&mut info),
                std::mem::size_of::<SHFILEINFOW>() as u32,
                SHGFI_ICON | SHGFI_LARGEICON,
            )
        };

        (ok != 0 && !info.hIcon.is_invalid()).then_some(info.hIcon)
    }

    fn icon_pixels(icon: HICON) -> Option<(u32, u32, Vec<u8>)> {
        let mut icon_info = ICONINFO::default();

        unsafe { GetIconInfo(icon, &mut icon_info) }.ok()?;

        let mut bitmap = BITMAP::default();

        unsafe {
            GetObjectW(
                HGDIOBJ(icon_info.hbmColor.0),
                std::mem::size_of::<BITMAP>() as i32,
                Some(&mut bitmap as *mut _ as *mut _),
            )
        };

        let (width, height) = (bitmap.bmWidth as u32, bitmap.bmHeight as u32);
        let mut buffer = vec![0u8; (width * height * 4) as usize];

        let mut header = BITMAPINFO::default();
        header.bmiHeader = BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width as i32,
            biHeight: -(height as i32),
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        };

        let dc = unsafe { GetDC(None) };

        let copied = unsafe {
            GetDIBits(
                dc,
                icon_info.hbmColor,
                0,
                height,
                Some(buffer.as_mut_ptr() as *mut _),
                &mut header,
                DIB_RGB_COLORS,
            )
        };

        unsafe {
            ReleaseDC(None, dc);
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmColor.0));
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmMask.0));
        }

        if copied == 0 {
            return None;
        }

        for pixel in buffer.chunks_exact_mut(4) {
            pixel.swap(0, 2);
        }

        Some((width, height, buffer))
    }

    pub fn icon_data_url(path: &str) -> Option<String> {
        // the shortcut itself carries the overlay arrow, its target does not
        let source = shortcut_target(path).unwrap_or_else(|| path.to_string());
        let icon = icon_handle(&source).or_else(|| icon_handle(path))?;
        let pixels = icon_pixels(icon);

        unsafe {
            let _ = DestroyIcon(icon);
        }

        let (width, height, buffer) = pixels?;
        let image = image::RgbaImage::from_raw(width, height, buffer)?;
        let mut png = std::io::Cursor::new(Vec::new());

        image.write_to(&mut png, image::ImageFormat::Png).ok()?;

        Some(format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(png.into_inner())
        ))
    }
}

#[tauri::command]
fn system_accent() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        use windows::core::w;
        use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};

        let mut value: u32 = 0;
        let mut size = std::mem::size_of::<u32>() as u32;

        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                w!(r"Software\Microsoft\Windows\DWM"),
                w!("AccentColor"),
                RRF_RT_REG_DWORD,
                None,
                Some(&mut value as *mut u32 as *mut _),
                Some(&mut size),
            )
        };

        if status.is_err() {
            return None;
        }

        let (red, green, blue) = (value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF);

        return Some(format!("#{red:02x}{green:02x}{blue:02x}"));
    }

    #[cfg(not(target_os = "windows"))]
    None
}

#[tauri::command]
fn apply_taskbar(
    app: tauri::AppHandle,
    height: f64,
    width: f64,
    floating: bool,
    hide_system_taskbar: bool,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window("taskbar") else {
        return Err("taskbar window is missing".into());
    };

    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    {
        appbar::reserve_bottom_edge(&window, floating).map_err(|e| e.to_string())?;
        appbar::keep_system_taskbar_hidden(hide_system_taskbar);
    }

    Ok(())
}

#[tauri::command]
fn launch_app(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    return winshell::launch(&path);

    #[cfg(not(target_os = "windows"))]
    Err(format!("unsupported platform for {path}"))
}

#[tauri::command]
fn app_icon(path: String) -> Option<String> {
    #[cfg(target_os = "windows")]
    return winshell::icon_data_url(&path);

    #[cfg(not(target_os = "windows"))]
    None
}

#[cfg(target_os = "windows")]
mod winkey {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::OnceLock;

    use tauri::{AppHandle, Manager};
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
        VIRTUAL_KEY, VK_LWIN, VK_RWIN,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
        UnhookWindowsHookEx, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP,
        WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    static REQUESTS: OnceLock<std::sync::mpsc::SyncSender<&'static str>> = OnceLock::new();

    const ERIS_TAG: usize = 0x4552_4953;
    // powertoys uses the same unassigned key so the shell stops seeing win as pressed alone
    const DUMMY_KEY: VIRTUAL_KEY = VIRTUAL_KEY(0xFF);

    static WIN_HELD: AtomicBool = AtomicBool::new(false);
    static WIN_COMBINED: AtomicBool = AtomicBool::new(false);

    fn hold(key: VIRTUAL_KEY, release: bool) {
        let input = INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: key,
                    dwExtraInfo: ERIS_TAG,
                    dwFlags: if release {
                        KEYEVENTF_KEYUP
                    } else {
                        KEYBD_EVENT_FLAGS(0)
                    },
                    ..Default::default()
                },
            },
        };

        unsafe { SendInput(&[input], std::mem::size_of::<INPUT>() as i32) };
    }

    fn tap(key: VIRTUAL_KEY) {
        let stroke = |flags: KEYBD_EVENT_FLAGS| INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: key,
                    dwExtraInfo: ERIS_TAG,
                    dwFlags: flags,
                    ..Default::default()
                },
            },
        };

        let inputs = [stroke(KEYBD_EVENT_FLAGS(0)), stroke(KEYEVENTF_KEYUP)];

        unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    }

    // ponytail: the hook must return within the LowLevelHooksTimeout, so only hand off here
    fn notify(event: &'static str) {
        if let Some(sender) = REQUESTS.get() {
            let _ = sender.try_send(event);
        }
    }

    unsafe extern "system" fn keyboard_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code < 0 {
            return unsafe { CallNextHookEx(None, code, wparam, lparam) };
        }

        let event = unsafe { *(lparam.0 as *const KBDLLHOOKSTRUCT) };
        let ours = event.dwExtraInfo == ERIS_TAG;
        let key = VIRTUAL_KEY(event.vkCode as u16);
        let is_win = key == VK_LWIN || key == VK_RWIN;

        if !ours {
            match wparam.0 as u32 {
                WM_KEYDOWN | WM_SYSKEYDOWN => {
                    if is_win {
                        if !WIN_HELD.swap(true, Ordering::Relaxed) {
                            WIN_COMBINED.store(false, Ordering::Relaxed);
                            tap(DUMMY_KEY);
                            notify("guard");
                        }

                        return LRESULT(1);
                    }

                    if WIN_HELD.load(Ordering::Relaxed)
                        && !WIN_COMBINED.swap(true, Ordering::Relaxed)
                    {
                        hold(VK_LWIN, false);
                    }
                }
                WM_KEYUP | WM_SYSKEYUP if is_win => {
                    WIN_HELD.store(false, Ordering::Relaxed);

                    tap(DUMMY_KEY);

                    if WIN_COMBINED.swap(false, Ordering::Relaxed) {
                        hold(VK_LWIN, true);
                    } else {
                        notify("toggle");
                    }

                    return LRESULT(1);
                }
                _ => {}
            }
        }

        unsafe { CallNextHookEx(None, code, wparam, lparam) }
    }

    fn foreground_process() -> String {
        use windows::Win32::System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
            PROCESS_QUERY_LIMITED_INFORMATION,
        };
        use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

        let mut pid = 0u32;

        unsafe { GetWindowThreadProcessId(GetForegroundWindow(), Some(&mut pid)) };

        let Ok(handle) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) })
        else {
            return String::new();
        };

        let mut buffer = [0u16; 260];
        let mut length = buffer.len() as u32;

        let query = unsafe {
            QueryFullProcessImageNameW(
                handle,
                PROCESS_NAME_WIN32,
                windows::core::PWSTR(buffer.as_mut_ptr()),
                &mut length,
            )
        };

        unsafe { let _ = windows::Win32::Foundation::CloseHandle(handle); }

        if query.is_err() {
            return String::new();
        }

        String::from_utf16_lossy(&buffer[..length as usize])
    }

    // ponytail: the ctrl tap usually keeps start closed; this dismisses it when the shell wins the race
    fn dismiss_shell_ui() {
        use windows::Win32::UI::Input::KeyboardAndMouse::VK_ESCAPE;

        for _ in 0..150 {
            let process = foreground_process();

            if process.contains("StartMenuExperienceHost") || process.contains("SearchHost") {
                tap(VK_ESCAPE);
                crate::trace("dismissed shell ui");

                return;
            }

            std::thread::sleep(std::time::Duration::from_millis(8));
        }
    }

    pub fn capture_start_key(app: AppHandle) {
        let (sender, receiver) = std::sync::mpsc::sync_channel(1);
        let _ = REQUESTS.set(sender);

        std::thread::spawn(move || {
            while let Ok(event) = receiver.recv() {
                if event == "guard" {
                    std::thread::spawn(dismiss_shell_ui);

                    continue;
                }

                crate::trace(event);

                let handle = app.clone();

                let _ = app.run_on_main_thread(move || {
                    if let Some(window) = handle.get_webview_window("main") {
                        crate::trace(&format!("toggling, visible={:?}", window.is_visible()));
                        crate::toggle(&window);
                    }
                });

                let handle = app.clone();

                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(220));

                    let _ = handle.clone().run_on_main_thread(move || {
                        if let Some(window) = handle.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.set_focus();
                            }
                        }
                    });
                });
            }
        });

        std::thread::spawn(|| unsafe {
            crate::trace("hook thread started");

            let hook = match SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook), None, 0) {
                Ok(handle) => handle,
                Err(error) => {
                    crate::trace(&format!("keyboard hook failed: {error}"));

                    return;
                }
            };

            let mut message = MSG::default();

            while GetMessageW(&mut message, None, 0, 0).as_bool() {
                let _ = TranslateMessage(&message);
                DispatchMessageW(&message);
            }

            let _ = UnhookWindowsHookEx(hook);
        });
    }
}

fn toggle(window: &tauri::WebviewWindow) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.center();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launcher_key = Shortcut::new(Some(Modifiers::ALT), Code::Space);

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if shortcut == &launcher_key && event.state() == ShortcutState::Pressed {
                        if let Some(window) = app.get_webview_window("main") {
                            toggle(&window);
                        }
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            list_apps,
            pinned_apps,
            launch_app,
            app_icon,
            apply_taskbar,
            system_accent
        ])
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let _ = app.global_shortcut().register(launcher_key);

            #[cfg(target_os = "windows")]
            winkey::capture_start_key(app.handle().clone());

            let window = app.get_webview_window("main").unwrap();

            window.on_window_event({
                let window = window.clone();
                move |event| {
                    if matches!(event, WindowEvent::Focused(false)) && !cfg!(debug_assertions) {
                        let _ = window.hide();
                    }
                }
            });

            #[cfg(target_os = "windows")]
            if let Some(taskbar) = app.get_webview_window("taskbar") {
                appbar::reserve_bottom_edge(&taskbar, false)?;
                appbar::keep_system_taskbar_hidden(true);
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            #[cfg(target_os = "windows")]
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(taskbar) = app.get_webview_window("taskbar") {
                    appbar::release(&taskbar);
                }
            }
        });
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    #[test]
    fn extracts_icon_from_a_start_menu_shortcut() {
        let apps = super::list_apps();
        assert!(!apps.is_empty(), "no start menu shortcuts found");

        let icon = apps
            .iter()
            .find_map(|app| super::winshell::icon_data_url(&app.path));

        assert!(
            icon.is_some_and(|data| data.starts_with("data:image/png;base64,")),
            "no icon extracted from any shortcut"
        );
    }
}
