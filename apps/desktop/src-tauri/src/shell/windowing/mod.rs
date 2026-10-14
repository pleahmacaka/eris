use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, Webview, WebviewWindow};

use crate::shell::desktop;

mod geometry;
pub(crate) mod region;

const BLUR_TOGGLE_GUARD: Duration = Duration::from_millis(250);
const SHOW_SETTLE: Duration = Duration::from_millis(400);
const FADE_OUT: Duration = Duration::from_millis(140);
const READY_FALLBACK: Duration = Duration::from_millis(1500);
const LAZY_KEEP: Duration = Duration::from_secs(120);
const BUILD_RETRY: Duration = Duration::from_millis(120);

static BLUR_HIDDEN_AT: Mutex<Option<Instant>> = Mutex::new(None);
static FADES: LazyLock<Mutex<HashMap<String, u64>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
static RETIRING: LazyLock<Mutex<HashMap<String, u64>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

// a freshly built transparent window shows nothing until its page mounts, so it waits for the page's ready call
static UNPAINTED: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));
static AWAITING: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));

// an emit can land before a lazy window's page exists, so open requests carry a pull-based intent instead
static PENDING_INTENT: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

static ANCHORS: LazyLock<Mutex<HashMap<String, [i32; 4]>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

pub fn set_anchor(label: &str, caller: &WebviewWindow, rect: Option<[f64; 4]>) {
    let screen = rect.and_then(|rect| {
        let origin = caller.inner_position().ok()?;
        let [left, top, right, bottom] = region::physical(rect, caller.scale_factor().ok()?);

        Some([
            origin.x + left,
            origin.y + top,
            origin.x + right,
            origin.y + bottom,
        ])
    });

    let mut anchors = ANCHORS.lock().unwrap();

    match screen {
        Some(screen) => anchors.insert(label.to_string(), screen),
        None => anchors.remove(label),
    };
}

fn anchor_of(label: &str) -> Option<[i32; 4]> {
    ANCHORS.lock().unwrap().get(label).copied()
}

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
pub fn set_window_region(
    window: WebviewWindow,
    rects: Option<Vec<[f64; 4]>>,
) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    let physical = rects.map(|rects| {
        rects
            .into_iter()
            .map(|rect| region::physical(rect, scale))
            .collect::<Vec<_>>()
    });

    region::set(hwnd, physical.as_deref(), true);

    Ok(())
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
        for _ in 0..3 {
            if window_for(&app, &label).is_some() {
                if !eris_window_kit::headless() {
                    on_main(&app, &label, show_now);
                }

                return;
            }

            std::thread::sleep(BUILD_RETRY);
        }
    });
}

#[tauri::command]
pub fn window_ready(window: WebviewWindow) {
    let label = window.label().to_string();

    UNPAINTED.lock().unwrap().remove(&label);
    on_main(window.app_handle(), &label, present_awaited);
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
            if crate::shell::edit::editing()
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

// child windows start hidden and show themselves from the page, which never re-shows a concealed webview
pub fn conceal_hidden(app: &AppHandle) {
    for config in &app.config().app.windows {
        let Some(window) = app.get_webview_window(&config.label) else {
            continue;
        };

        if !window.is_visible().unwrap_or(true) {
            set_webview_visible(&window, false);
        }
    }
}

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
            let _ = window.hide();
            set_webview_visible(&window, false);
            let _ = window.app_handle().emit("window-hidden", label.clone());

            if lazy(window.app_handle(), &label) {
                retire(window);
            }
        });
    });
}

// lazy windows stay warm for a while after hiding, then close to free their renderer
fn retire(window: WebviewWindow) {
    let label = window.label().to_string();
    let gen = {
        let mut retiring = RETIRING.lock().unwrap();
        let gen = retiring.get(&label).copied().unwrap_or(0) + 1;
        retiring.insert(label.clone(), gen);
        gen
    };

    std::thread::spawn(move || {
        std::thread::sleep(LAZY_KEEP);

        let app = window.app_handle().clone();

        let _ = app.run_on_main_thread(move || {
            let mut retiring = RETIRING.lock().unwrap();

            if retiring.get(&label) == Some(&gen) && !window.is_visible().unwrap_or(true) {
                retiring.remove(&label);
                let _ = window.destroy();
            }
        });
    });
}

fn lazy_config(app: &AppHandle, label: &str) -> Option<tauri::utils::config::WindowConfig> {
    app.config()
        .app
        .windows
        .iter()
        .find(|window| window.label == label && !window.create)
        .cloned()
}

fn lazy(app: &AppHandle, label: &str) -> bool {
    lazy_config(app, label).is_some()
}

pub(crate) fn window_for(app: &AppHandle, label: &str) -> Option<WebviewWindow> {
    if let Some(window) = app.get_webview_window(label) {
        return Some(window);
    }

    let config = lazy_config(app, label)?;

    let builder = tauri::WebviewWindowBuilder::from_config(app, &config).ok()?;
    let builder = if label == "studio" {
        builder
            .icon(tauri::include_image!("icons/studio.png"))
            .ok()?
    } else {
        builder
    };

    let window = eris_window_kit::build(builder).ok()?;

    UNPAINTED.lock().unwrap().insert(label.to_string());

    Some(window)
}

fn reveal(window: &WebviewWindow) {
    if eris_window_kit::headless() || crate::shell::features::dock_deferred(window.label()) {
        return;
    }

    cancel_fade(window.label());
    RETIRING.lock().unwrap().remove(window.label());
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
        show(app, label);

        return;
    };

    let _ = match label {
        "main" | "settings" | "note" | "onboarding" | "studio" => {
            geometry::center_on_cursor_monitor(&window)
        }
        "panel" => geometry::dock_panel(app, &window),
        "notices" => match anchor_of(label) {
            Some(anchor) => geometry::anchor_panel(&window, anchor),
            None => geometry::dock_panel(app, &window),
        },
        _ => Ok(()),
    };

    if UNPAINTED.lock().unwrap().contains(label) {
        AWAITING.lock().unwrap().insert(label.to_string());

        let app = app.clone();
        let label = label.to_string();

        std::thread::spawn(move || {
            std::thread::sleep(READY_FALLBACK);
            UNPAINTED.lock().unwrap().remove(&label);
            on_main(&app, &label, present_awaited);
        });

        return;
    }

    present(app, &window, label);
}

fn present_awaited(app: &AppHandle, label: &str) {
    if UNPAINTED.lock().unwrap().contains(label) || !AWAITING.lock().unwrap().remove(label) {
        return;
    }

    if let Some(window) = app.get_webview_window(label) {
        present(app, &window, label);
    }
}

fn present(app: &AppHandle, window: &WebviewWindow, label: &str) {
    reveal(window);

    if !matches!(label, "taskbar" | "topbar") {
        let _ = window.set_focus();
        desktop::force_foreground(window);
    }

    // transient panels must not linger when the focus grab silently failed
    if matches!(label, "panel" | "notices") {
        hide_on_blur(window);
    }

    let _ = app.emit("window-shown", label);
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
