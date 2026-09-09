use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};

use crate::{appbar, windowing};

static EDITING: AtomicBool = AtomicBool::new(false);

pub fn editing() -> bool {
    EDITING.load(Ordering::Relaxed)
}

#[tauri::command]
pub fn edit_mode(app: AppHandle, on: bool) {
    EDITING.store(on, Ordering::Relaxed);

    if on {
        std::thread::spawn(move || {
            let Some(window) = windowing::window_for(&app, "edit") else {
                return;
            };
            let [x, y, width, height] = win::virtual_screen();

            let _ = window.set_position(PhysicalPosition::new(x, y));
            let _ = window.set_size(PhysicalSize::new(width, height));
            windowing::show(&app, "edit");
        });

        return;
    }

    windowing::hide(&app, "edit");
    windowing::hide(&app, "main");
    lift_features(&app, false);

    let _ = app.emit("edit-mode", false);
}

#[tauri::command]
pub fn edit_raise(app: AppHandle) {
    lift_features(&app, true);
    windowing::show(&app, "main");

    let _ = app.emit("edit-mode", true);
}

fn lift_features(app: &AppHandle, up: bool) {
    let rests = [("taskbar", !appbar::desktop_pinned()), ("chat", true)];

    for (label, rest) in rests {
        let Some(window) = app.get_webview_window(label) else {
            continue;
        };

        if let Ok(hwnd) = window.hwnd() {
            appbar::lift(hwnd, up || rest);
        }
    }
}

#[cfg(target_os = "windows")]
mod win {
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
        SM_YVIRTUALSCREEN,
    };

    pub fn virtual_screen() -> [i32; 4] {
        unsafe {
            [
                GetSystemMetrics(SM_XVIRTUALSCREEN),
                GetSystemMetrics(SM_YVIRTUALSCREEN),
                GetSystemMetrics(SM_CXVIRTUALSCREEN),
                GetSystemMetrics(SM_CYVIRTUALSCREEN),
            ]
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    pub fn virtual_screen() -> [i32; 4] {
        [0, 0, 1920, 1080]
    }
}
