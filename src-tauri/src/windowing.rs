use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow};

use crate::{appbar, desktop};

const BLUR_TOGGLE_GUARD: Duration = Duration::from_millis(250);

static BLUR_HIDDEN_AT: Mutex<Option<Instant>> = Mutex::new(None);

#[tauri::command]
pub fn show_window(app: AppHandle, label: String) {
    show(&app, &label);
}

#[tauri::command]
pub fn hide_window(app: AppHandle, label: String) {
    hide(&app, &label);
}

#[tauri::command]
pub fn toggle_window(app: AppHandle, label: String) {
    toggle(&app, &label);
}

pub fn show(app: &AppHandle, label: &str) {
    on_main(app, label, show_now);
}

pub fn hide(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.hide();
    }
}

pub fn hide_on_blur(window: &WebviewWindow) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        *BLUR_HIDDEN_AT.lock().unwrap() = Some(Instant::now());
    }
}

pub fn toggle(app: &AppHandle, label: &str) {
    on_main(app, label, |app, label| {
        let visible = app
            .get_webview_window(label)
            .and_then(|window| window.is_visible().ok())
            .unwrap_or(false);

        if visible {
            hide(app, label);
        } else if !(label == "main" && just_hidden_by_blur()) {
            show_now(app, label);
        }
    });
}

fn just_hidden_by_blur() -> bool {
    BLUR_HIDDEN_AT
        .lock()
        .unwrap()
        .take()
        .is_some_and(|at| at.elapsed() < BLUR_TOGGLE_GUARD)
}

fn on_main(app: &AppHandle, label: &str, action: fn(&AppHandle, &str)) {
    let handle = app.clone();
    let label = label.to_string();

    let _ = app.run_on_main_thread(move || action(&handle, &label));
}

fn show_now(app: &AppHandle, label: &str) {
    let Some(window) = app.get_webview_window(label) else {
        return;
    };

    let _ = match label {
        "main" => center_on_cursor_monitor(&window),
        "panel" => dock_panel(app, &window),
        "settings" | "onboarding" => window.center(),
        _ => Ok(()),
    };

    let _ = window.show();

    if label != "taskbar" {
        let _ = window.set_focus();
        desktop::force_foreground(&window);
    }

    let _ = app.emit("window-shown", label);
}

fn physical_size_on(window: &WebviewWindow, scale: f64) -> tauri::Result<(i32, i32)> {
    let logical = window
        .outer_size()?
        .to_logical::<f64>(window.scale_factor()?);

    Ok((
        (logical.width * scale).round() as i32,
        (logical.height * scale).round() as i32,
    ))
}

fn center_on_cursor_monitor(window: &WebviewWindow) -> tauri::Result<()> {
    let cursor = window.cursor_position()?;

    let Some(monitor) = window.monitor_from_point(cursor.x, cursor.y)? else {
        return window.center();
    };

    let work = monitor.work_area();
    let (width, height) = physical_size_on(window, monitor.scale_factor())?;
    let x = work.position.x + (work.size.width as i32 - width) / 2;
    let y = work.position.y + (work.size.height as i32 - height) / 2;

    window.set_position(PhysicalPosition::new(x, y))
}

fn dock_panel(app: &AppHandle, window: &WebviewWindow) -> tauri::Result<()> {
    let dock = app
        .get_webview_window("taskbar")
        .map(|dock| Ok::<_, tauri::Error>((dock.outer_position()?, dock.outer_size()?)))
        .transpose()?;

    let anchored = match dock {
        Some((position, dock_size)) => window.monitor_from_point(
            f64::from(position.x + dock_size.width as i32 / 2),
            f64::from(position.y + dock_size.height as i32 / 2),
        )?,
        None => None,
    };

    let monitor = match anchored {
        Some(monitor) => Some(monitor),
        None => window.primary_monitor()?,
    };

    let Some(monitor) = monitor else {
        return window.center();
    };

    let scale = monitor.scale_factor();
    let gap = (8.0 * scale).round() as i32;
    let (width, height) = physical_size_on(window, scale)?;
    let screen_right = monitor.position().x + monitor.size().width as i32;
    let screen_bottom = monitor.position().y + monitor.size().height as i32;
    let x = screen_right - gap - width;

    let y = match dock {
        Some((position, dock_size)) if appbar::edge_is_top() => {
            position.y + dock_size.height as i32 + gap
        }
        Some((position, _)) => position.y - gap - height,
        None => screen_bottom - gap - height,
    };

    window.set_position(PhysicalPosition::new(x, y))
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::{just_hidden_by_blur, BLUR_HIDDEN_AT, BLUR_TOGGLE_GUARD};

    #[test]
    fn a_toggle_right_after_a_blur_hide_is_swallowed_once() {
        *BLUR_HIDDEN_AT.lock().unwrap() = Some(Instant::now());

        assert!(just_hidden_by_blur());
        assert!(!just_hidden_by_blur());

        *BLUR_HIDDEN_AT.lock().unwrap() =
            Some(Instant::now() - BLUR_TOGGLE_GUARD - Duration::from_millis(1));

        assert!(!just_hidden_by_blur());
    }
}
