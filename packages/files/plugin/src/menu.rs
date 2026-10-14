use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Webview, WebviewWindow, WindowEvent};
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Shell::{DefSubclassProc, SetWindowSubclass};
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowPos, ShowWindow, HWND_TOPMOST, MA_NOACTIVATE, SWP_FRAMECHANGED, SWP_NOACTIVATE,
    SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SWP_SHOWWINDOW, SW_HIDE, WM_MOUSEACTIVATE, WM_NCCALCSIZE,
};

use crate::error::{Error, Result};
use crate::{com, Host};

pub const LABEL: &str = "files-menu";

static READY: AtomicBool = AtomicBool::new(false);

#[derive(Deserialize)]
pub struct Placement {
    owner: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    margin: f64,
}

#[derive(Serialize)]
pub struct Placed {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
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

    // tao keeps an invisible resize frame on undecorated windows, which would swallow clicks beside the menu
    if message == WM_NCCALCSIZE && wparam.0 != 0 {
        return LRESULT(0);
    }

    unsafe { DefSubclassProc(hwnd, message, wparam, lparam) }
}

#[tauri::command]
pub async fn menu_prepare(app: AppHandle) -> Result<bool> {
    if app.get_webview_window(LABEL).is_some() {
        return Ok(READY.load(Ordering::Relaxed));
    }

    let route = app.state::<Host>().menu_route;
    let builder = eris_window_kit::child(&app, LABEL, route)
        .focusable(false)
        .focused(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .resizable(false)
        .shadow(false)
        .inner_size(240.0, 120.0)
        .disable_drag_drop_handler();
    let window = eris_window_kit::build(builder)?;
    let raw = com::hwnd(&window);

    // subclassing only works from the thread that owns the window
    window.run_on_main_thread(move || unsafe {
        let hwnd = com::owner(raw);
        let _ = SetWindowSubclass(hwnd, Some(on_message), 1, 0);
        let _ = SetWindowPos(
            hwnd,
            None,
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        );
    })?;

    window.on_window_event(|event| {
        if let WindowEvent::Destroyed = event {
            READY.store(false, Ordering::Relaxed);
        }
    });

    Ok(false)
}

#[tauri::command]
pub fn menu_ready() {
    READY.store(true, Ordering::Relaxed);
}

#[tauri::command]
pub async fn menu_place(
    app: AppHandle,
    window: WebviewWindow,
    placement: Placement,
) -> Result<Placed> {
    let owner = app
        .get_webview_window(&placement.owner)
        .ok_or_else(|| Error::Os("the menu owner closed".into()))?;
    let scale = owner.scale_factor()?;
    let origin = owner.inner_position()?;
    let point_x = origin.x + (placement.x * scale).round() as i32;
    let point_y = origin.y + (placement.y * scale).round() as i32;
    let monitor = match app.monitor_from_point(point_x as f64, point_y as f64)? {
        Some(monitor) => monitor,
        None => owner
            .current_monitor()?
            .ok_or_else(|| Error::Os("no monitor under the menu".into()))?,
    };
    let ratio = monitor.scale_factor();
    let area = monitor.work_area();
    let width = (placement.width * ratio).ceil() as i32;
    let height = (placement.height * ratio).ceil() as i32;
    let margin = (placement.margin * ratio).round() as i32;
    let (left, top) = (area.position.x, area.position.y);
    let right = left + area.size.width as i32;
    let bottom = top + area.size.height as i32;

    let mut x = point_x - margin;

    if x + width > right {
        x = point_x - width + margin;
    }

    let mut y = point_y - margin;

    if y + height > bottom {
        y = point_y - height + margin;
    }

    let placed = Placed {
        x: x.clamp(left, (right - width).max(left)),
        y: y.clamp(top, (bottom - height).max(top)),
        width,
        height,
    };

    show(&window, &placed)?;

    Ok(placed)
}

// the first move lets the window adopt the target monitor's DPI before the size is applied in its pixels
fn show(window: &WebviewWindow, placed: &Placed) -> Result<()> {
    let hwnd = window.hwnd()?;
    let visible = !eris_window_kit::headless();
    let flags = if visible {
        SWP_NOACTIVATE | SWP_SHOWWINDOW
    } else {
        SWP_NOACTIVATE
    };

    unsafe {
        SetWindowPos(
            hwnd,
            None,
            placed.x,
            placed.y,
            0,
            0,
            SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
        )?;
        SetWindowPos(
            hwnd,
            Some(HWND_TOPMOST),
            placed.x,
            placed.y,
            placed.width,
            placed.height,
            flags,
        )?;
    }

    if visible {
        let webview: &Webview = window.as_ref();

        webview.show()?;
    }

    Ok(())
}

#[tauri::command]
pub fn menu_hide(window: WebviewWindow) -> Result<()> {
    let _ = unsafe { ShowWindow(window.hwnd()?, SW_HIDE) };

    Ok(())
}

pub fn release(app: &AppHandle, closing: &str) {
    let alone = app
        .webview_windows()
        .keys()
        .all(|label| label == LABEL || label == closing);

    if alone {
        if let Some(menu) = app.get_webview_window(LABEL) {
            let _ = menu.destroy();
        }
    }
}
