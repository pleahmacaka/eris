use std::collections::HashSet;
use std::sync::Mutex;

use eris_window_kit::Intents;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Runtime, State, WebviewWindow};

use crate::pty::Sessions;

pub const ADOPT: &str = "eris-terminal:adopt";

#[derive(Default)]
pub struct Hosts(Mutex<HashSet<String>>);

impl Hosts {
    pub fn forget(&self, label: &str) {
        self.0.lock().unwrap().remove(label);
    }
}

pub(crate) struct Host {
    pub route: String,
}

#[derive(Clone, Default, Serialize)]
pub struct Intent {
    cwd: Option<String>,
    handoff: Option<Value>,
}

pub fn open_window<R: Runtime>(
    app: &AppHandle<R>,
    cwd: Option<String>,
) -> tauri::Result<WebviewWindow<R>> {
    open_intent(app, Intent { cwd, handoff: None })
}

fn open_intent<R: Runtime>(app: &AppHandle<R>, intent: Intent) -> tauri::Result<WebviewWindow<R>> {
    let label = eris_window_kit::label("terminal");
    let route = app.state::<Host>().route.clone();
    let builder = eris_window_kit::child(app, &label, &route)
        .title("Eris Terminal")
        .inner_size(960.0, 600.0)
        .min_inner_size(480.0, 300.0)
        .icon(tauri::include_image!("icons/128x128.png"))?
        .disable_drag_drop_handler();

    app.state::<Intents<Intent>>().open(&label, intent, builder)
}

#[tauri::command]
pub(crate) fn take_intent<R: Runtime>(
    window: WebviewWindow<R>,
    intents: State<'_, Intents<Intent>>,
) -> Intent {
    intents.take(window.label())
}

#[tauri::command(async)]
pub(crate) fn new_window<R: Runtime>(
    app: AppHandle<R>,
    cwd: Option<String>,
    handoff: Option<Value>,
) -> Result<(), String> {
    open_intent(&app, Intent { cwd, handoff })
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn register_host<R: Runtime>(window: WebviewWindow<R>, hosts: State<'_, Hosts>) {
    hosts.0.lock().unwrap().insert(window.label().to_string());
}

fn contains<R: Runtime>(window: &WebviewWindow<R>, point: PhysicalPosition<f64>) -> bool {
    let shown = window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(true);
    let (Ok(origin), Ok(size)) = (window.outer_position(), window.outer_size()) else {
        return false;
    };

    shown
        && point.x >= origin.x as f64
        && point.y >= origin.y as f64
        && point.x < (origin.x + size.width as i32) as f64
        && point.y < (origin.y + size.height as i32) as f64
}

// the dragged tab's sessions move to the target first, so closing an emptied source window cannot kill them
#[tauri::command(async)]
pub(crate) fn tear_off<R: Runtime>(
    app: AppHandle<R>,
    window: WebviewWindow<R>,
    hosts: State<'_, Hosts>,
    sessions: State<'_, Sessions>,
    handoff: Value,
    ptys: Vec<u32>,
) -> Result<(), String> {
    let point = app.cursor_position().map_err(|e| e.to_string())?;
    let target = hosts
        .0
        .lock()
        .unwrap()
        .iter()
        .filter(|label| *label != window.label())
        .filter_map(|label| app.get_webview_window(label))
        .find(|host| contains(host, point));

    if let Some(host) = target {
        sessions.hand_over(&ptys, host.label());

        return host
            .emit_to(host.label(), ADOPT, handoff)
            .map_err(|e| e.to_string());
    }

    let opened = open_intent(
        &app,
        Intent {
            cwd: None,
            handoff: Some(handoff),
        },
    )
    .map_err(|e| e.to_string())?;

    sessions.hand_over(&ptys, opened.label());
    let _ = opened.set_position(PhysicalPosition::new(point.x - 160.0, point.y - 20.0));

    Ok(())
}
