use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Webview, WebviewWindow};
use tauri_plugin_store::StoreExt;

use crate::{appbar, chat_window, desktop};

const BLUR_TOGGLE_GUARD: Duration = Duration::from_millis(250);
const SHOW_SETTLE: Duration = Duration::from_millis(400);
const FADE_OUT: Duration = Duration::from_millis(140);
const LAZY: [&str; 4] = ["settings", "files", "onboarding", "edit"];

static BLUR_HIDDEN_AT: Mutex<Option<Instant>> = Mutex::new(None);
static FADES: LazyLock<Mutex<HashMap<String, u64>>> = LazyLock::new(|| Mutex::new(HashMap::new()));

// an emit can land before a lazy window's page exists, so open requests carry a pull-based intent instead
static PENDING_INTENT: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

#[tauri::command]
pub fn show_window(app: AppHandle, label: String) {
    show(&app, &label);
}

#[tauri::command]
pub fn open_with_intent(app: AppHandle, label: String, intent: String) {
    PENDING_INTENT.lock().unwrap().insert(label.clone(), intent);
    show(&app, &label);
}

#[tauri::command]
pub fn take_intent(label: String) -> Option<String> {
    PENDING_INTENT.lock().unwrap().remove(&label)
}

#[tauri::command]
pub fn hide_window(app: AppHandle, label: String) {
    hide(&app, &label);
}

#[tauri::command]
pub fn toggle_window(app: AppHandle, label: String) {
    toggle(&app, &label);
}

// building a webview inside a main-thread callback deadlocks the event loop, so lazy windows are built from a helper thread
pub fn show(app: &AppHandle, label: &str) {
    let app = app.clone();
    let label = label.to_string();

    std::thread::spawn(move || {
        if window_for(&app, &label).is_some() {
            on_main(&app, &label, show_now);
        }
    });
}

pub fn hide(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        conceal(&window);
    }
}

pub fn hide_on_blur(window: &WebviewWindow) {
    if !window.is_visible().unwrap_or(false) {
        return;
    }

    let window = window.clone();
    let app = window.app_handle().clone();

    std::thread::spawn(move || {
        // the shell steals focus back for a beat after show, so judge focus only after the settle window
        std::thread::sleep(SHOW_SETTLE);

        let _ = app.run_on_main_thread(move || {
            if crate::edit::editing()
                || window.is_focused().unwrap_or(true)
                || !window.is_visible().unwrap_or(false)
            {
                return;
            }

            conceal(&window);
            *BLUR_HIDDEN_AT.lock().unwrap() = Some(Instant::now());
        });
    });
}

// tauri hides only the HWND, so the WebView2 controller keeps rendering until it is hidden as well
pub(crate) fn set_webview_visible(window: &WebviewWindow, visible: bool) {
    let webview: &Webview = window.as_ref();

    let _ = if visible {
        webview.show()
    } else {
        webview.hide()
    };
}

pub fn webview_visible(app: &AppHandle, label: &str, visible: bool) {
    if let Some(window) = app.get_webview_window(label) {
        set_webview_visible(&window, visible);
    }
}

pub fn conceal_hidden(app: &AppHandle) {
    for window in app.webview_windows().values() {
        if !window.is_visible().unwrap_or(true) {
            set_webview_visible(window, false);
        }
    }
}

// lazy windows are rebuilt from config on the next show, so closing them frees their renderer
fn conceal(window: &WebviewWindow) {
    let label = window.label().to_string();
    let app = window.app_handle().clone();

    let _ = app.emit("window-hiding", label.clone());

    let gen = {
        let mut fades = FADES.lock().unwrap();
        let gen = fades.get(&label).copied().unwrap_or(0) + 1;
        fades.insert(label.clone(), gen);
        gen
    };
    let window = window.clone();

    std::thread::spawn(move || {
        std::thread::sleep(FADE_OUT);

        let proceed = {
            let mut fades = FADES.lock().unwrap();

            if fades.get(&label) == Some(&gen) {
                fades.remove(&label);
                true
            } else {
                false
            }
        };

        if !proceed {
            return;
        }

        let _ = app.run_on_main_thread(move || {
            if LAZY.contains(&label.as_str()) {
                let _ = window.destroy();
            } else {
                let _ = window.hide();
                set_webview_visible(&window, false);
            }

            let _ = window.app_handle().emit("window-hidden", label);
        });
    });
}

pub(crate) fn window_for(app: &AppHandle, label: &str) -> Option<WebviewWindow> {
    if let Some(window) = app.get_webview_window(label) {
        return Some(window);
    }

    if !LAZY.contains(&label) {
        return None;
    }

    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == label)?
        .clone();

    tauri::WebviewWindowBuilder::from_config(app, &config)
        .ok()?
        .build()
        .ok()
}

fn reveal(window: &WebviewWindow) {
    cancel_fade(window.label());
    set_webview_visible(window, true);
    let _ = window.show();
}

fn cancel_fade(label: &str) {
    FADES.lock().unwrap().remove(label);
}

fn fading(label: &str) -> bool {
    FADES.lock().unwrap().contains_key(label)
}

pub fn toggle(app: &AppHandle, label: &str) {
    on_main(app, label, |app, label| {
        let visible = app
            .get_webview_window(label)
            .and_then(|window| window.is_visible().ok())
            .unwrap_or(false);

        if visible && !fading(label) {
            hide(app, label);
        } else if !(label == "main" && just_hidden_by_blur()) {
            show(app, label);
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
        "panel" | "notices" => dock_panel(app, &window),
        "settings" | "onboarding" => window.center(),
        "chat" => chat_window::park_chat(&window),
        _ => Ok(()),
    };

    reveal(&window);

    if !matches!(label, "taskbar" | "topbar" | "chat") {
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
    // the dock window keeps room above its band for menus, so follow the band the appbar reserved
    let anchor = if appbar::topbar_on(app) && appbar::bar_frame("topbar").is_some() {
        "topbar"
    } else {
        "taskbar"
    };

    let dock = appbar::bar_frame(anchor).map(|[left, top, width, height]| {
        (
            PhysicalPosition::new(left, top),
            tauri::PhysicalSize::new(width as u32, height as u32),
        )
    });

    let dock = match dock {
        Some(frame) => Some(frame),
        None => app
            .get_webview_window("taskbar")
            .map(|dock| Ok::<_, tauri::Error>((dock.outer_position()?, dock.outer_size()?)))
            .transpose()?,
    };

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

    let x = match stored_panel_position(app).as_str() {
        "left" => monitor.position().x + gap,
        "center" => monitor.position().x + (monitor.size().width as i32 - width) / 2,
        _ => screen_right - gap - width,
    };

    let anchor_top = anchor == "topbar" || appbar::edge_is_top();

    let y = match dock {
        Some((position, dock_size)) if anchor_top => position.y + dock_size.height as i32 + gap,
        Some((position, _)) => position.y - gap - height,
        None => screen_bottom - gap - height,
    };

    window.set_position(PhysicalPosition::new(x, y))
}

fn stored_panel_position(app: &AppHandle) -> String {
    app.store("settings.json")
        .ok()
        .and_then(|store| store.get("device"))
        .and_then(|device| {
            device
                .get("panelPosition")?
                .as_str()
                .map(std::string::ToString::to_string)
        })
        .unwrap_or_else(|| "right".into())
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
