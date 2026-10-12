#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod apps;
#[cfg_attr(windows, path = "windows.rs")]
#[cfg_attr(target_os = "macos", path = "macos.rs")]
#[cfg_attr(all(unix, not(target_os = "macos")), path = "linux.rs")]
mod platform;

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, RunEvent};
use tauri_plugin_updater::UpdaterExt;

use apps::{APPS, PUBKEY, VERSION};

pub(crate) fn fail(error: impl std::fmt::Display) -> String {
    error.to_string()
}

pub(crate) struct Invocation {
    pub update: bool,
    pub quiet: bool,
}

// the tauri updater in Eris runs the downloaded installer with `/P|/S /UPDATE [/R /ARGS ...]` and exits
pub(crate) fn invocation() -> Invocation {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let has = |flag: &str| args.iter().any(|arg| arg == flag);

    Invocation {
        update: has("/UPDATE"),
        quiet: has("/S"),
    }
}

#[derive(Serialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Step {
    Running,
    Done,
    Failed,
}

#[derive(Serialize, Clone)]
struct Progress {
    id: &'static str,
    state: Step,
    error: Option<String>,
}

#[derive(Default)]
struct Report {
    progress: Vec<Progress>,
    finished: bool,
}

#[derive(Default)]
struct Session(Mutex<Report>);

impl Session {
    fn failed(&self) -> bool {
        let report = self.0.lock().unwrap();

        report
            .progress
            .iter()
            .any(|step| step.state == Step::Failed)
    }
}

#[derive(Serialize)]
struct Overview {
    version: &'static str,
    update: bool,
    preset: Vec<&'static str>,
    components: Vec<apps::Component>,
    progress: Vec<Progress>,
    finished: bool,
}

fn record(handle: &AppHandle, progress: Progress) {
    {
        let mut report = handle.state::<Session>().inner().0.lock().unwrap();

        report.progress.retain(|step| step.id != progress.id);
        report.progress.push(progress.clone());
    }

    let _ = handle.emit("install-progress", progress);
}

fn write_log(handle: &AppHandle, failures: &[String]) {
    let Ok(dir) = handle.path().app_log_dir() else {
        return;
    };
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_or(0, |since| since.as_secs());
    let lines: String = failures
        .iter()
        .map(|failure| format!("{stamp} {VERSION} {failure}\n"))
        .collect();

    let _ = std::fs::create_dir_all(&dir);
    let _ = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("installer.log"))
        .and_then(|mut file| std::io::Write::write_all(&mut file, lines.as_bytes()));
}

fn finish(handle: &AppHandle) {
    let failures: Vec<String> = {
        let mut report = handle.state::<Session>().inner().0.lock().unwrap();

        report.finished = true;
        report
            .progress
            .iter()
            .filter_map(|step| Some(format!("{}: {}", step.id, step.error.as_ref()?)))
            .collect()
    };

    let _ = handle.emit("install-finished", ());

    if !failures.is_empty() {
        write_log(handle, &failures);
    }

    let call = invocation();

    if !call.update {
        return;
    }

    if failures.is_empty() {
        handle.exit(0);
    } else if call.quiet {
        handle.exit(1);
    } else if let Some(window) = handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// APPS lists eris first for display; installing in reverse runs eris last so its relaunch comes after the rest
fn run_queue(handle: &AppHandle, ids: &[String]) {
    *handle.state::<Session>().inner().0.lock().unwrap() = Report::default();

    for app in APPS
        .iter()
        .rev()
        .filter(|app| ids.iter().any(|id| id == app.id))
    {
        let progress = |state, error| Progress {
            id: app.id,
            state,
            error,
        };

        record(handle, progress(Step::Running, None));

        let result: Result<(), String> = app
            .payload
            .ok_or_else(|| "payload missing".to_string())
            .and_then(|payload| platform::install(app, payload));

        match result {
            Ok(()) => record(handle, progress(Step::Done, None)),
            Err(error) => record(handle, progress(Step::Failed, Some(error))),
        }
    }

    finish(handle);
}

#[tauri::command]
fn overview(handle: AppHandle) -> Overview {
    let update = invocation().update;
    let report = handle.state::<Session>().inner().0.lock().unwrap();

    Overview {
        version: VERSION,
        update,
        preset: apps::preset(update),
        components: apps::components(),
        progress: report.progress.clone(),
        finished: report.finished,
    }
}

#[tauri::command]
async fn install(handle: AppHandle, ids: Vec<String>) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || run_queue(&handle, &ids))
        .await
        .map_err(fail)
}

#[tauri::command]
async fn check_update(handle: AppHandle) -> Result<Option<String>, String> {
    let update = handle
        .updater()
        .map_err(fail)?
        .check()
        .await
        .map_err(fail)?;

    Ok(update.map(|update| update.version))
}

#[tauri::command]
async fn self_update(handle: AppHandle) -> Result<(), String> {
    let update = handle
        .updater()
        .map_err(fail)?
        .check()
        .await
        .map_err(fail)?
        .ok_or("no update")?;
    let bytes = update.download(|_, _| {}, || {}).await.map_err(fail)?;
    let version = update.version;

    tauri::async_runtime::spawn_blocking(move || platform::launch_installer(&bytes, &version))
        .await
        .map_err(fail)??;

    handle.exit(0);

    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        .plugin(
            tauri_plugin_updater::Builder::new()
                .pubkey(PUBKEY)
                .target(platform::MANIFEST_KEY)
                .build(),
        )
        .manage(Session::default())
        .invoke_handler(tauri::generate_handler![
            overview,
            install,
            check_update,
            self_update
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            if invocation().update {
                let ids: Vec<String> = apps::preset(true).into_iter().map(String::from).collect();

                tauri::async_runtime::spawn_blocking(move || run_queue(&handle, &ids));
            } else if let Some(window) = app.get_webview_window("main") {
                window.show()?;
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the Eris installer");

    app.run(|handle, event| {
        if let RunEvent::ExitRequested {
            code: None, api, ..
        } = event
        {
            if handle.state::<Session>().failed() {
                api.prevent_exit();
                handle.exit(1);
            }
        }
    });
}
