use eris_window_kit::Intents;
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State, WebviewWindow};

pub(crate) struct Host {
    pub route: String,
}

#[derive(Clone, Default, Serialize)]
pub struct Intent {
    cwd: Option<String>,
}

pub fn open_window<R: Runtime>(
    app: &AppHandle<R>,
    cwd: Option<String>,
) -> tauri::Result<WebviewWindow<R>> {
    let label = eris_window_kit::label("terminal");
    let route = app.state::<Host>().route.clone();
    let builder = eris_window_kit::child(app, &label, &route)
        .title("Eris Terminal")
        .inner_size(960.0, 600.0)
        .min_inner_size(480.0, 300.0)
        .disable_drag_drop_handler();

    app.state::<Intents<Intent>>()
        .open(&label, Intent { cwd }, builder)
}

#[tauri::command]
pub(crate) fn take_intent<R: Runtime>(
    window: WebviewWindow<R>,
    intents: State<'_, Intents<Intent>>,
) -> Intent {
    intents.take(window.label())
}

#[tauri::command(async)]
pub(crate) fn new_window<R: Runtime>(app: AppHandle<R>, cwd: Option<String>) -> Result<(), String> {
    open_window(&app, cwd)
        .map(|_| ())
        .map_err(|e| e.to_string())
}
