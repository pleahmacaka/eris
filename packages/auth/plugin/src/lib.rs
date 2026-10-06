use std::path::PathBuf;
use std::sync::Mutex;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_deep_link::DeepLinkExt;

mod vault;

const PROJECT: &str = "https://mrvnlrzalljdsdnvbagu.supabase.co";
const SCHEMES: [&str; 3] = ["eris", "eris-files", "eris-terminal"];
const CHANGED: &str = "eris-auth-changed";
const CALLBACK: &str = "eris-auth-callback";

static PENDING: Mutex<Option<String>> = Mutex::new(None);

struct Scheme(&'static str);

pub fn is_callback(url: &str) -> bool {
    SCHEMES
        .iter()
        .any(|scheme| url.starts_with(&format!("{scheme}://auth/callback")))
}

pub fn claims(args: &[String]) -> bool {
    args.iter().any(|arg| is_callback(arg))
}

fn folder(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .local_data_dir()
        .map(|dir| dir.join("com.arixlab.eris.auth"))
        .map_err(|e| e.to_string())
}

fn accept(app: &AppHandle, url: String) {
    *PENDING.lock().unwrap() = Some(url);

    let _ = app.emit(CALLBACK, ());
}

#[tauri::command]
fn load(app: AppHandle, key: String) -> Result<Option<String>, String> {
    vault::load(&folder(&app)?, &key)
}

#[tauri::command]
fn store(app: AppHandle, key: String, value: String) -> Result<(), String> {
    vault::store(&folder(&app)?, &key, &value)?;

    let _ = app.emit(CHANGED, ());

    Ok(())
}

#[tauri::command]
fn forget(app: AppHandle, key: String) -> Result<(), String> {
    vault::forget(&folder(&app)?, &key)?;

    let _ = app.emit(CHANGED, ());

    Ok(())
}

#[tauri::command]
fn redirect(scheme: tauri::State<Scheme>) -> String {
    format!("{}://auth/callback", scheme.0)
}

#[tauri::command]
fn take_callback() -> Option<String> {
    PENDING.lock().unwrap().take()
}

#[cfg(not(windows))]
#[tauri::command]
fn open_authorize(url: String) -> Result<(), String> {
    if !url.starts_with(&format!("{PROJECT}/auth/v1/authorize?")) {
        return Err("invalid".into());
    }

    open::that_detached(url).map_err(|_| "unreachable".to_string())
}

#[cfg(windows)]
#[tauri::command]
fn open_authorize(url: String) -> Result<(), String> {
    use windows::core::{w, HSTRING};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    if !url.starts_with(&format!("{PROJECT}/auth/v1/authorize?")) {
        return Err("invalid".into());
    }

    let opened = unsafe {
        ShellExecuteW(
            None,
            w!("open"),
            &HSTRING::from(url),
            None,
            None,
            SW_SHOWNORMAL,
        )
    };

    // ShellExecute reports success with any value above 32
    if opened.0 as usize > 32 {
        Ok(())
    } else {
        Err("unreachable".into())
    }
}

pub fn init(scheme: &'static str) -> TauriPlugin<Wry> {
    Builder::new("eris-auth")
        .invoke_handler(tauri::generate_handler![
            load,
            store,
            forget,
            redirect,
            take_callback,
            open_authorize
        ])
        .setup(move |app, _| {
            app.manage(Scheme(scheme));

            let links = app.deep_link();

            let _ = links.register(scheme);

            let started = links.get_current().ok().flatten().unwrap_or_default();

            if let Some(url) = started.iter().map(|url| url.to_string()).find(|url| is_callback(url)) {
                accept(app, url);
            }

            let handle = app.clone();

            links.on_open_url(move |event| {
                for url in event.urls() {
                    let url = url.to_string();

                    if is_callback(&url) {
                        accept(&handle, url);
                    }
                }
            });

            Ok(())
        })
        .build()
}
