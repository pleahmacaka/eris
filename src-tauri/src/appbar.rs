use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::Deserialize;
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_store::StoreExt;

use crate::monitors;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskbarLayout {
    pub edge: String,
    pub height: f64,
    pub width: f64,
    pub floating: bool,
    pub auto_hide: bool,
    pub hide_system_taskbar: bool,
    #[serde(default)]
    pub monitor: Option<String>,
}

impl Default for TaskbarLayout {
    fn default() -> Self {
        Self {
            edge: "bottom".into(),
            height: 48.0,
            width: 720.0,
            floating: false,
            auto_hide: false,
            hide_system_taskbar: true,
            monitor: None,
        }
    }
}

static TOP: AtomicBool = AtomicBool::new(false);
static LAST: Mutex<Option<TaskbarLayout>> = Mutex::new(None);
static SCREEN: Mutex<Option<[i32; 4]>> = Mutex::new(None);

pub fn edge_is_top() -> bool {
    TOP.load(Ordering::Relaxed)
}

pub fn dock_screen() -> Option<[i32; 4]> {
    *SCREEN.lock().unwrap()
}

pub fn stored_layout(app: &AppHandle) -> TaskbarLayout {
    let device = app
        .store("settings.json")
        .ok()
        .and_then(|store| store.get("device"));
    let field = |key: &str| device.as_ref().and_then(|device| device.get(key).cloned());
    let base = TaskbarLayout::default();

    TaskbarLayout {
        edge: field("dockEdge")
            .and_then(|v| v.as_str().map(String::from))
            .unwrap_or(base.edge),
        height: field("dockHeight")
            .and_then(|v| v.as_f64())
            .unwrap_or(base.height),
        width: field("dockWidth")
            .and_then(|v| v.as_f64())
            .unwrap_or(base.width),
        floating: field("dockStyle").is_some_and(|v| v.as_str() == Some("mac")),
        auto_hide: field("dockAutoHide")
            .and_then(|v| v.as_bool())
            .unwrap_or(base.auto_hide),
        hide_system_taskbar: field("hideSystemTaskbar")
            .and_then(|v| v.as_bool())
            .unwrap_or(base.hide_system_taskbar),
        monitor: field("dockMonitor").and_then(|v| v.as_str().map(String::from)),
    }
}

#[tauri::command]
pub fn apply_taskbar(app: AppHandle, layout: TaskbarLayout) -> Result<(), String> {
    let window = app
        .get_webview_window("taskbar")
        .ok_or("taskbar window is missing")?;

    apply(&window, &layout).map_err(|e| e.to_string())
}

pub fn apply(window: &WebviewWindow, layout: &TaskbarLayout) -> tauri::Result<()> {
    TOP.store(layout.edge == "top", Ordering::Relaxed);
    *LAST.lock().unwrap() = Some(layout.clone());

    let Some(screen) = monitors::resolve(window, layout.monitor.as_deref())? else {
        return Ok(());
    };

    *SCREEN.lock().unwrap() = Some(monitors::bounds(&screen));

    win::watch_shell(window);
    win::keep_system_taskbar_hidden(layout.hide_system_taskbar);
    win::place(window, layout, &screen)?;
    win::raise(window);

    Ok(())
}

pub fn reapply(window: &WebviewWindow) {
    let layout = LAST.lock().unwrap().clone();

    if let Some(layout) = layout {
        let _ = apply(window, &layout);
    }
}

pub fn release(window: &WebviewWindow) {
    win::release(window);
}

#[cfg(target_os = "windows")]
pub fn shell_tray() -> Option<isize> {
    win::tray_window().map(|hwnd| hwnd.0 as isize)
}

#[cfg(target_os = "windows")]
mod win {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
    use std::sync::{Mutex, OnceLock};
    use std::thread::JoinHandle;
    use std::time::Duration;

    use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, WebviewWindow};
    use tauri_plugin_store::StoreExt;
    use windows::core::w;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
    use windows::Win32::UI::Shell::{
        DefSubclassProc, SHAppBarMessage, SetWindowSubclass, ABE_BOTTOM, ABE_TOP, ABM_GETSTATE,
        ABM_NEW, ABM_QUERYPOS, ABM_REMOVE, ABM_SETAUTOHIDEBAR, ABM_SETPOS, ABM_SETSTATE,
        ABN_POSCHANGED, ABS_AUTOHIDE, APPBARDATA,
    };
    use windows::Win32::System::Threading::GetCurrentProcessId;
    use windows::Win32::UI::WindowsAndMessaging::{
        FindWindowExW, GetWindowThreadProcessId, RegisterWindowMessageW, SetWindowPos, ShowWindow,
        HWND_TOPMOST, SWP_NOZORDER,
        MA_NOACTIVATE, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SW_HIDE, SW_SHOW, WM_DISPLAYCHANGE,
        WM_DPICHANGED, WM_MOUSEACTIVATE,
    };

    use super::TaskbarLayout;

    const CALLBACK_MESSAGE: u32 = 0x8000 + 1;
    const HIDE_POLL: Duration = Duration::from_millis(500);
    const SHELL_STATE_KEY: &str = "shellTaskbarState";

    static REGISTERED: AtomicBool = AtomicBool::new(false);
    static HOOKED: AtomicBool = AtomicBool::new(false);
    static REAPPLY_PENDING: AtomicBool = AtomicBool::new(false);
    static APP: OnceLock<AppHandle> = OnceLock::new();
    static HIDER: Mutex<Option<(Sender<()>, JoinHandle<()>)>> = Mutex::new(None);

    fn payload(hwnd: HWND, edge: u32) -> APPBARDATA {
        APPBARDATA {
            cbSize: std::mem::size_of::<APPBARDATA>() as u32,
            hWnd: hwnd,
            uCallbackMessage: CALLBACK_MESSAGE,
            uEdge: edge,
            ..Default::default()
        }
    }

    pub fn span(band: &RECT, floating: bool, width: i32) -> (i32, i32) {
        if floating {
            (band.left + (band.right - band.left - width) / 2, width)
        } else {
            (band.left, band.right - band.left)
        }
    }

    pub fn offset(band: &RECT, top: bool, margin: i32, height: i32) -> i32 {
        if top {
            band.top + margin
        } else {
            band.bottom - margin - height
        }
    }

    fn fit_band(data: &mut APPBARDATA, band: i32) {
        if data.uEdge == ABE_TOP {
            data.rc.bottom = data.rc.top + band;
        } else {
            data.rc.top = data.rc.bottom - band;
        }
    }

    pub fn place(
        window: &WebviewWindow,
        layout: &TaskbarLayout,
        monitor: &Monitor,
    ) -> tauri::Result<()> {
        let scale = monitor.scale_factor();
        let origin = monitor.position();
        let screen = monitor.size();
        let height = (layout.height * scale).round() as i32;
        let width = (layout.width * scale).round() as i32;
        let margin = if layout.floating {
            (12.0 * scale).round() as i32
        } else {
            0
        };
        let band = height + margin * 2;
        let edge = if layout.edge == "top" {
            ABE_TOP
        } else {
            ABE_BOTTOM
        };
        let mut data = payload(window.hwnd()?, edge);

        data.rc = RECT {
            left: origin.x,
            top: origin.y,
            right: origin.x + screen.width as i32,
            bottom: origin.y + screen.height as i32,
        };
        fit_band(&mut data, band);

        unsafe {
            if layout.auto_hide {
                SHAppBarMessage(ABM_REMOVE, &mut data);
                SHAppBarMessage(ABM_NEW, &mut data);
                REGISTERED.store(true, Ordering::Relaxed);
                data.lParam = LPARAM(1);
                SHAppBarMessage(ABM_SETAUTOHIDEBAR, &mut data);
            } else {
                if !REGISTERED.swap(true, Ordering::Relaxed) {
                    SHAppBarMessage(ABM_NEW, &mut data);
                }

                data.lParam = LPARAM(0);
                SHAppBarMessage(ABM_SETAUTOHIDEBAR, &mut data);
                SHAppBarMessage(ABM_QUERYPOS, &mut data);
                fit_band(&mut data, band);
                SHAppBarMessage(ABM_SETPOS, &mut data);
            }
        }

        let (left, width) = span(&data.rc, layout.floating, width);
        let top = offset(&data.rc, edge == ABE_TOP, margin, height);

        window.set_position(PhysicalPosition::new(left, top))?;
        window.set_size(PhysicalSize::new(width as u32, height as u32))?;

        Ok(())
    }

    pub fn raise(window: &WebviewWindow) {
        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let _ = SetWindowPos(
                    hwnd,
                    Some(HWND_TOPMOST),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                );
            }
        }
    }

    pub fn watch_shell(window: &WebviewWindow) {
        if HOOKED.swap(true, Ordering::Relaxed) {
            return;
        }

        let _ = APP.set(window.app_handle().clone());

        if let Ok(hwnd) = window.hwnd() {
            unsafe {
                let _ = SetWindowSubclass(hwnd, Some(on_message), 1, 0);
            }
        }
    }

    fn taskbar_created() -> u32 {
        static MESSAGE: OnceLock<u32> = OnceLock::new();

        *MESSAGE.get_or_init(|| unsafe { RegisterWindowMessageW(w!("TaskbarCreated")) })
    }

    unsafe extern "system" fn on_message(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _id: usize,
        _data: usize,
    ) -> LRESULT {
        if message == WM_MOUSEACTIVATE {
            return LRESULT(MA_NOACTIVATE as isize);
        }

        let restarted = message != 0 && message == taskbar_created();

        if restarted {
            REGISTERED.store(false, Ordering::Relaxed);
            reapply_shell_state();
        }

        let layout_changed = restarted
            || match message {
                CALLBACK_MESSAGE => wparam.0 as u32 == ABN_POSCHANGED,
                WM_DISPLAYCHANGE | WM_DPICHANGED => true,
                _ => false,
            };

        if layout_changed && !REAPPLY_PENDING.swap(true, Ordering::Relaxed) {
            if let Some(app) = APP.get() {
                let handle = app.clone();

                let queued = app.run_on_main_thread(move || {
                    if let Some(taskbar) = handle.get_webview_window("taskbar") {
                        super::reapply(&taskbar);
                    }

                    REAPPLY_PENDING.store(false, Ordering::Relaxed);
                });

                if queued.is_err() {
                    REAPPLY_PENDING.store(false, Ordering::Relaxed);
                }
            }
        }

        unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
    }

    pub fn release(window: &WebviewWindow) {
        if let Ok(hwnd) = window.hwnd() {
            let mut data = payload(hwnd, ABE_BOTTOM);

            unsafe {
                SHAppBarMessage(ABM_REMOVE, &mut data);
            }
        }

        REGISTERED.store(false, Ordering::Relaxed);
        keep_system_taskbar_hidden(false);
    }

    fn ours(hwnd: HWND) -> bool {
        let mut owner = 0;

        unsafe { GetWindowThreadProcessId(hwnd, Some(&mut owner)) };

        owner == unsafe { GetCurrentProcessId() }
    }

    fn tray_windows() -> Vec<HWND> {
        let mut found = Vec::new();

        for class in [w!("Shell_TrayWnd"), w!("Shell_SecondaryTrayWnd")] {
            let mut previous = None;

            while let Ok(hwnd) = unsafe { FindWindowExW(None, previous, class, None) } {
                previous = Some(hwnd);

                if !ours(hwnd) {
                    found.push(hwnd);
                }
            }
        }

        found
    }

    fn set_system_taskbar_visible(visible: bool) {
        let command = if visible { SW_SHOW } else { SW_HIDE };

        for hwnd in tray_windows() {
            unsafe {
                let _ = ShowWindow(hwnd, command);
            }
        }
    }

    pub fn tray_window() -> Option<HWND> {
        tray_windows().into_iter().next()
    }

    fn set_shell_state(state: usize) -> bool {
        let Some(tray) = tray_window() else {
            return false;
        };

        let mut data = payload(tray, ABE_BOTTOM);

        data.lParam = LPARAM(state as isize);

        unsafe {
            SHAppBarMessage(ABM_SETSTATE, &mut data);
        }

        true
    }

    fn current_shell_state() -> usize {
        let mut data = payload(HWND::default(), ABE_BOTTOM);

        unsafe { SHAppBarMessage(ABM_GETSTATE, &mut data) }
    }

    fn saved_shell_state() -> Option<usize> {
        APP.get()?
            .store("settings.json")
            .ok()?
            .get(SHELL_STATE_KEY)?
            .as_u64()
            .map(|state| state as usize)
    }

    fn save_shell_state(state: Option<usize>) {
        let Some(store) = APP.get().and_then(|app| app.store("settings.json").ok()) else {
            return;
        };

        match state {
            Some(state) => store.set(SHELL_STATE_KEY, state as u64),
            None => {
                store.delete(SHELL_STATE_KEY);
            }
        }

        let _ = store.save();
    }

    // ponytail: explorer keeps its work-area strip while merely hidden, so park it in auto-hide first
    fn shell_taskbar_autohide(enabled: bool) {
        if enabled {
            if tray_window().is_none() {
                return;
            }

            let previous = saved_shell_state().unwrap_or_else(current_shell_state);

            save_shell_state(Some(previous));
            set_shell_state(previous | ABS_AUTOHIDE as usize);
        } else if let Some(previous) = saved_shell_state() {
            if set_shell_state(previous) {
                save_shell_state(None);
            }
        }
    }

    fn reapply_shell_state() {
        let hiding = HIDER.lock().unwrap().is_some();

        if hiding {
            shell_taskbar_autohide(true);
        }
    }

    // ponytail: explorer re-shows the tray on its own events, so poll instead of hiding once
    pub fn keep_system_taskbar_hidden(hidden: bool) {
        let mut hider = HIDER.lock().unwrap();

        if !hidden {
            if let Some((stop, worker)) = hider.take() {
                drop(stop);
                let _ = worker.join();
            }

            shell_taskbar_autohide(false);
            set_system_taskbar_visible(true);

            return;
        }

        if hider.is_some() {
            return;
        }

        shell_taskbar_autohide(true);

        let (stop, stopped) = channel::<()>();
        let worker = std::thread::spawn(move || loop {
            set_system_taskbar_visible(false);

            if stopped.recv_timeout(HIDE_POLL) != Err(RecvTimeoutError::Timeout) {
                break;
            }
        });

        *hider = Some((stop, worker));
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use tauri::{Monitor, WebviewWindow};

    use super::TaskbarLayout;

    pub fn place(
        _window: &WebviewWindow,
        _layout: &TaskbarLayout,
        _monitor: &Monitor,
    ) -> tauri::Result<()> {
        Ok(())
    }

    pub fn raise(_window: &WebviewWindow) {}

    pub fn watch_shell(_window: &WebviewWindow) {}

    pub fn release(_window: &WebviewWindow) {}

    pub fn keep_system_taskbar_hidden(_hidden: bool) {}
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use windows::Win32::Foundation::RECT;

    use super::win::{offset, span};
    use super::TaskbarLayout;

    const SECONDARY: RECT = RECT {
        left: 1920,
        top: -120,
        right: 4480,
        bottom: 1320,
    };

    #[test]
    fn a_full_width_dock_spans_the_chosen_monitor() {
        assert_eq!(span(&SECONDARY, false, 720), (1920, 2560));
    }

    #[test]
    fn a_floating_dock_centers_on_the_chosen_monitor() {
        assert_eq!(span(&SECONDARY, true, 720), (2840, 720));
    }

    #[test]
    fn the_band_hugs_the_chosen_edge() {
        assert_eq!(offset(&SECONDARY, true, 12, 48), -108);
        assert_eq!(offset(&SECONDARY, false, 12, 48), 1260);
    }

    #[test]
    fn a_payload_without_a_monitor_still_deserializes() {
        let layout: TaskbarLayout = serde_json::from_str(
            r#"{"edge":"top","height":48,"width":720,"floating":false,"autoHide":false,"hideSystemTaskbar":true}"#,
        )
        .unwrap();

        assert!(layout.monitor.is_none());
    }
}
