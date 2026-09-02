use tauri::AppHandle;

pub fn watch(app: AppHandle) {
    win::watch(app);
}

#[cfg(target_os = "windows")]
mod win {
    use std::time::{Duration, Instant};

    use serde_json::json;
    use tauri::{AppHandle, Emitter, Manager};
    use windows::Win32::Foundation::{HWND, POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
    };
    use windows::Win32::System::Threading::GetCurrentProcessId;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetClassNameW, GetCursorPos, GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId,
        SetWindowPos, ShowWindow, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
        SWP_SHOWWINDOW, SW_HIDE,
    };

    const TICK: Duration = Duration::from_millis(80);
    const LINGER: Duration = Duration::from_millis(800);
    const EDGE: i32 = 2;
    const SLACK: i32 = 8;
    const DESKTOP_CLASSES: [&str; 3] = ["Progman", "WorkerW", "Shell_TrayWnd"];
    const OVERLAY_CLASSES: [&str; 5] = [
        "MultitaskingViewFrame",
        "XamlExplorerHostIslandWindow",
        "ForegroundStaging",
        "Windows.UI.Core.CoreWindow",
        "TaskListThumbnailWnd",
    ];

    pub fn watch(app: AppHandle) {
        let Some(dock) = app
            .get_webview_window("taskbar")
            .and_then(|window| window.hwnd().ok())
        else {
            return;
        };
        let dock = dock.0 as isize;

        std::thread::spawn(move || run(app, HWND(dock as _)));
    }

    fn run(app: AppHandle, dock: HWND) {
        let mut at_edge = false;
        let mut fullscreen = false;
        let mut revealed = false;
        let mut left_band: Option<Instant> = None;

        loop {
            std::thread::sleep(TICK);

            let screen = screen();
            let cursor = cursor();
            let edge_now = near_edge(cursor, &screen);

            if edge_now != at_edge {
                at_edge = edge_now;
                let _ = app.emit("dock-edge", json!({ "atEdge": at_edge }));
            }

            if let Some(fullscreen_now) = foreground_covers(&screen) {
                if fullscreen_now != fullscreen {
                    fullscreen = fullscreen_now;
                    revealed = false;
                    left_band = None;
                    set_visible(&app, dock, !fullscreen);
                    let _ = app.emit("dock-fullscreen", json!({ "fullscreen": fullscreen }));
                }
            }

            if !fullscreen {
                continue;
            }

            if at_edge && !revealed {
                revealed = true;
                left_band = None;
                set_visible(&app, dock, true);
            }

            if !revealed {
                continue;
            }

            if stay_revealed(cursor, at_edge, window_rect(dock)) {
                left_band = None;
            } else if left_band.get_or_insert_with(Instant::now).elapsed() >= LINGER {
                revealed = false;
                left_band = None;
                set_visible(&app, dock, false);
            }
        }
    }

    fn screen() -> RECT {
        match crate::appbar::dock_screen() {
            Some([left, top, right, bottom]) => RECT {
                left,
                top,
                right,
                bottom,
            },
            None => primary_screen(),
        }
    }

    fn primary_screen() -> RECT {
        let monitor = unsafe { MonitorFromPoint(POINT::default(), MONITOR_DEFAULTTOPRIMARY) };
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        if unsafe { GetMonitorInfoW(monitor, &mut info) }.as_bool() {
            info.rcMonitor
        } else {
            RECT::default()
        }
    }

    fn cursor() -> POINT {
        let mut point = POINT::default();

        unsafe {
            let _ = GetCursorPos(&mut point);
        }

        point
    }

    fn window_rect(hwnd: HWND) -> RECT {
        let mut rect = RECT::default();

        unsafe {
            let _ = GetWindowRect(hwnd, &mut rect);
        }

        rect
    }

    pub fn inflate(rect: RECT, by: i32) -> RECT {
        RECT {
            left: rect.left - by,
            top: rect.top - by,
            right: rect.right + by,
            bottom: rect.bottom + by,
        }
    }

    pub fn inside(point: POINT, rect: &RECT) -> bool {
        point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom
    }

    fn edge_band(screen: &RECT) -> RECT {
        if crate::appbar::edge_is_top() {
            RECT {
                bottom: screen.top + EDGE,
                ..*screen
            }
        } else {
            RECT {
                top: screen.bottom - EDGE,
                ..*screen
            }
        }
    }

    pub fn near_edge(cursor: POINT, screen: &RECT) -> bool {
        inside(cursor, &edge_band(screen))
    }

    pub fn stay_revealed(cursor: POINT, at_edge: bool, dock: RECT) -> bool {
        at_edge || inside(cursor, &inflate(dock, SLACK))
    }

    fn class_name(hwnd: HWND) -> String {
        let mut buffer = [0u16; 64];
        let length = unsafe { GetClassNameW(hwnd, &mut buffer) }.max(0) as usize;

        String::from_utf16_lossy(&buffer[..length])
    }

    fn foreground_covers(screen: &RECT) -> Option<bool> {
        let front = unsafe { GetForegroundWindow() };

        if front.is_invalid() {
            return None;
        }

        let class = class_name(front);

        if OVERLAY_CLASSES.contains(&class.as_str()) {
            return None;
        }

        let mut pid = 0u32;

        unsafe {
            GetWindowThreadProcessId(front, Some(&mut pid));
        }

        if pid == unsafe { GetCurrentProcessId() } || DESKTOP_CLASSES.contains(&class.as_str()) {
            return Some(false);
        }

        let rect = window_rect(front);

        Some(
            rect.left <= screen.left
                && rect.top <= screen.top
                && rect.right >= screen.right
                && rect.bottom >= screen.bottom,
        )
    }

    fn set_visible(app: &AppHandle, dock: HWND, visible: bool) {
        unsafe {
            if visible {
                let _ = SetWindowPos(
                    dock,
                    Some(HWND_TOPMOST),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
                );
            } else {
                let _ = ShowWindow(dock, SW_HIDE);
            }
        }

        let _ = app.emit("dock-visible", json!({ "visible": visible }));
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use tauri::AppHandle;

    pub fn watch(_app: AppHandle) {}
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use windows::Win32::Foundation::{POINT, RECT};

    use super::win::{inflate, inside, near_edge, stay_revealed};

    const SCREEN: RECT = RECT {
        left: 0,
        top: 0,
        right: 1920,
        bottom: 1080,
    };

    const FLOATING_DOCK: RECT = RECT {
        left: 600,
        top: 1020,
        right: 1320,
        bottom: 1068,
    };

    #[test]
    fn bottom_edge_is_the_last_two_rows() {
        assert!(near_edge(POINT { x: 960, y: 1079 }, &SCREEN));
        assert!(near_edge(POINT { x: 960, y: 1078 }, &SCREEN));
        assert!(!near_edge(POINT { x: 960, y: 1077 }, &SCREEN));
        assert!(!near_edge(POINT { x: -1, y: 1079 }, &SCREEN));
    }

    const SECONDARY: RECT = RECT {
        left: 1920,
        top: -120,
        right: 4480,
        bottom: 1320,
    };

    #[test]
    fn the_edge_follows_the_monitor_the_dock_sits_on() {
        assert!(near_edge(POINT { x: 3000, y: 1319 }, &SECONDARY));
        assert!(!near_edge(POINT { x: 3000, y: 1317 }, &SECONDARY));
        assert!(!near_edge(POINT { x: 960, y: 1079 }, &SECONDARY));
    }

    #[test]
    fn a_monitor_stacked_below_the_primary_is_not_the_edge() {
        assert!(!near_edge(POINT { x: 960, y: 1080 }, &SCREEN));
        assert!(!near_edge(POINT { x: 960, y: 1900 }, &SCREEN));
        assert!(!near_edge(POINT { x: 960, y: -900 }, &SCREEN));
    }

    #[test]
    fn band_slack_extends_the_dock_rect() {
        let band = inflate(
            RECT {
                left: 0,
                top: 1032,
                right: 1920,
                bottom: 1080,
            },
            8,
        );

        assert!(inside(POINT { x: 10, y: 1025 }, &band));
        assert!(!inside(POINT { x: 10, y: 1023 }, &band));
    }

    #[test]
    fn a_cursor_on_the_edge_keeps_a_floating_dock_revealed() {
        let cursor = POINT { x: 960, y: 1079 };

        assert!(!inside(cursor, &inflate(FLOATING_DOCK, 8)));
        assert!(stay_revealed(
            cursor,
            near_edge(cursor, &SCREEN),
            FLOATING_DOCK
        ));
        assert!(!stay_revealed(
            POINT { x: 960, y: 900 },
            false,
            FLOATING_DOCK
        ));
    }
}
