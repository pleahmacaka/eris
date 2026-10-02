use std::path::Path;

use eris_window_kit::Intents;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, WebviewWindow, WindowEvent};

use crate::address;
use crate::default_app::MODEL_TYPES;
use crate::error::Result;
use crate::{actions, Host};

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Intent {
    pub path: Option<String>,
    pub select: Option<String>,
}

#[derive(Default, Debug, PartialEq)]
pub struct Launch {
    pub target: Option<String>,
    pub select: bool,
}

pub fn parse(args: &[String]) -> Launch {
    let mut launch = Launch::default();

    for arg in args.iter().filter(|arg| !arg.starts_with('-')) {
        let mut rest = arg.trim();

        while !rest.is_empty() {
            let (head, tail) = rest.split_once(',').unwrap_or((rest, ""));
            let head = head.trim();

            if head.is_empty() {
                rest = tail.trim_start();
                continue;
            }

            if !head.starts_with('/') {
                launch.target = Some(rest.trim().trim_matches('"').to_string());
                break;
            }

            match head.to_ascii_lowercase().as_str() {
                "/select" => launch.select = true,
                "/idlist" => {
                    rest = tail
                        .split_once(',')
                        .map_or("", |(_, after)| after)
                        .trim_start();
                    continue;
                }
                _ => {}
            }

            rest = tail.trim_start();
        }
    }

    launch
}

fn track(window: &WebviewWindow) {
    let label = window.label().to_string();

    window.on_window_event(move |event| {
        if let WindowEvent::Destroyed = event {
            crate::watch::forget(&label);
        }
    });
}

fn build(
    app: &AppHandle,
    prefix: &str,
    route: &str,
    title: &str,
    intent: Intent,
    native_drop: bool,
) -> Result<WebviewWindow> {
    let label = eris_window_kit::label(prefix);
    let mut builder = eris_window_kit::child(app, &label, route)
        .title(title)
        .inner_size(1180.0, 740.0)
        .min_inner_size(560.0, 380.0);

    if !native_drop {
        builder = builder.disable_drag_drop_handler();
    }

    let window = app
        .state::<Intents<Intent>>()
        .open(&label, intent, builder)?;

    track(&window);

    Ok(window)
}

pub fn open_window(app: &AppHandle, intent: Intent) -> Result<WebviewWindow> {
    let route = app.state::<Host>().main_route;

    build(app, "files", route, "Eris Files", intent, true)
}

pub fn open_viewer(app: &AppHandle, path: String) -> Result<WebviewWindow> {
    let route = app.state::<Host>().viewer_route;
    let title = Path::new(&path)
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default();

    build(
        app,
        "viewer",
        route,
        &title,
        Intent {
            path: Some(path),
            select: None,
        },
        false,
    )
}

#[tauri::command]
pub fn take_intent(window: WebviewWindow, intents: State<'_, Intents<Intent>>) -> Intent {
    intents.take(window.label())
}

#[tauri::command(async)]
pub fn new_window(app: AppHandle, path: Option<String>) -> Result<()> {
    open_window(&app, Intent { path, select: None }).map(|_| ())
}

enum Target {
    Folder(Intent),
    File(String),
}

fn target(launch: &Launch, cwd: &Path) -> Target {
    let Some(raw) = launch.target.as_deref() else {
        return Target::Folder(Intent::default());
    };

    let Ok(found) = address::resolve(raw, Some(cwd)) else {
        return Target::Folder(Intent::default());
    };

    if found.file && !launch.select {
        return Target::File(found.select.unwrap_or_default());
    }

    if launch.select && !found.file {
        let parent = Path::new(&found.path)
            .parent()
            .map(|parent| parent.to_string_lossy().to_string());

        if let Some(parent) = parent {
            return Target::Folder(Intent {
                path: Some(parent),
                select: Some(found.path),
            });
        }
    }

    Target::Folder(Intent {
        path: (!found.path.is_empty()).then_some(found.path),
        select: found.select,
    })
}

fn is_model(path: &str) -> bool {
    Path::new(path).extension().is_some_and(|ext| {
        MODEL_TYPES
            .iter()
            .any(|model| ext.eq_ignore_ascii_case(model))
    })
}

fn open_file(app: &AppHandle, path: String) -> bool {
    // Eris Files can be the .obj handler, so executing a model would relaunch us forever
    if is_model(&path) {
        return open_viewer(app, path).is_ok();
    }

    let _ = actions::execute(0, &path);

    false
}

pub fn start(app: &AppHandle, args: &[String], cwd: &Path) -> bool {
    open(app, &parse(args), cwd)
}

pub fn open(app: &AppHandle, launch: &Launch, cwd: &Path) -> bool {
    match target(launch, cwd) {
        Target::File(path) => open_file(app, path),
        Target::Folder(intent) => open_window(app, intent).is_ok(),
    }
}

pub fn forward(app: &AppHandle, args: &[String], cwd: &str) {
    start(app, args.get(1..).unwrap_or_default(), Path::new(cwd));
}
