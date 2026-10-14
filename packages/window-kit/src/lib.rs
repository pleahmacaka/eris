use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Mutex, PoisonError};

use tauri::webview::{NewWindowFeatures, NewWindowResponse};
use tauri::{AppHandle, Runtime, Url, WebviewWindow, WebviewWindowBuilder};

const LINK_SCHEMES: [&str; 3] = ["http", "https", "mailto"];

static NEXT: AtomicU32 = AtomicU32::new(1);

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Channel {
    Stable,
    DevChannel,
    Dev,
}

pub const CHANNEL: Channel = if option_env!("ERIS_DEV_CHANNEL").is_some() {
    Channel::DevChannel
} else if cfg!(debug_assertions) {
    Channel::Dev
} else {
    Channel::Stable
};

pub const fn by_channel(
    stable: &'static str,
    dev_channel: &'static str,
    dev: &'static str,
) -> &'static str {
    match CHANNEL {
        Channel::Stable => stable,
        Channel::DevChannel => dev_channel,
        Channel::Dev => dev,
    }
}

// Keep shared plugin data and URL handlers in the same channel as the host.
pub fn channel_name(name: &str) -> String {
    format!("{name}{}", by_channel("", ".dev-channel", ".dev"))
}

pub fn scheme(name: &str) -> String {
    format!("{name}{}", by_channel("", "-dev-channel", "-dev"))
}

pub fn headless() -> bool {
    CHANNEL == Channel::Dev && std::env::var("ERIS_DEV_HEADLESS").as_deref() == Ok("1")
}

// This is injected before page code runs, including in dynamically created children.
pub fn development<R: Runtime>() -> tauri::plugin::TauriPlugin<R> {
    let script = if headless() {
        "Object.defineProperty(window, '__ERIS_HEADLESS__', { value: true });"
    } else {
        ""
    };

    tauri::plugin::Builder::new("eris-development")
        .js_init_script(script.to_string())
        .build()
}

pub struct Intents<T>(Mutex<HashMap<String, T>>);

impl<T> Default for Intents<T> {
    fn default() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

impl<T: Default> Intents<T> {
    pub fn take(&self, label: &str) -> T {
        self.0.lock().unwrap().remove(label).unwrap_or_default()
    }
}

impl<T> Intents<T> {
    // the page asks for its intent while loading, so the intent must exist before the window does
    pub fn open<R: Runtime>(
        &self,
        label: &str,
        intent: T,
        builder: WebviewWindowBuilder<'_, R, AppHandle<R>>,
    ) -> tauri::Result<WebviewWindow<R>> {
        self.0.lock().unwrap().insert(label.to_string(), intent);

        build(builder).inspect_err(|_| {
            self.0.lock().unwrap().remove(label);
        })
    }
}

const RUNTIME_FOLDER: &str = "WEBVIEW2_BROWSER_EXECUTABLE_FOLDER";

static PINS: Mutex<usize> = Mutex::new(0);

struct Pin;

impl Pin {
    fn new(folder: std::path::PathBuf) -> Self {
        let mut pins = PINS.lock().unwrap_or_else(PoisonError::into_inner);

        *pins += 1;
        std::env::set_var(RUNTIME_FOLDER, folder);

        Pin
    }
}

impl Drop for Pin {
    fn drop(&mut self) {
        let mut pins = PINS.lock().unwrap_or_else(PoisonError::into_inner);

        *pins -= 1;

        if *pins == 0 {
            std::env::remove_var(RUNTIME_FOLDER);
        }
    }
}

// a WebView2 update while the app runs makes every later window fail, because new environments pick the newer runtime but the data folder is held by the running one
pub fn build<R: Runtime>(
    builder: WebviewWindowBuilder<'_, R, AppHandle<R>>,
) -> tauri::Result<WebviewWindow<R>> {
    let _pin = running_browser_folder().map(Pin::new);

    builder.build()
}

#[cfg(windows)]
fn running_browser_folder() -> Option<std::path::PathBuf> {
    use windows::core::PWSTR;
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };

    let own = std::process::id();
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }.ok()?;
    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    let mut browser = None;
    let mut more = unsafe { Process32FirstW(snapshot, &mut entry) }.is_ok();

    while more {
        let length = entry.szExeFile.iter().position(|&c| c == 0).unwrap_or(0);
        let name = String::from_utf16_lossy(&entry.szExeFile[..length]);

        if entry.th32ParentProcessID == own && name.eq_ignore_ascii_case("msedgewebview2.exe") {
            browser = Some(entry.th32ProcessID);
            break;
        }

        more = unsafe { Process32NextW(snapshot, &mut entry) }.is_ok();
    }

    let _ = unsafe { CloseHandle(snapshot) };

    let process =
        unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, browser?) }.ok()?;
    let mut path = [0u16; 1024];
    let mut size = path.len() as u32;
    let found = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(path.as_mut_ptr()),
            &mut size,
        )
    };
    let _ = unsafe { CloseHandle(process) };

    found.ok()?;

    std::path::PathBuf::from(String::from_utf16_lossy(&path[..size as usize]))
        .parent()
        .map(std::path::Path::to_path_buf)
}

#[cfg(not(windows))]
fn running_browser_folder() -> Option<std::path::PathBuf> {
    None
}

pub fn label(prefix: &str) -> String {
    format!("{prefix}-{}", NEXT.fetch_add(1, Ordering::Relaxed))
}

// windows only join the host's WebView2 browser process when their arguments match
#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub fn child<'a, R: Runtime>(
    app: &'a AppHandle<R>,
    label: &str,
    route: &str,
) -> WebviewWindowBuilder<'a, R, AppHandle<R>> {
    let builder = WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::App(route.into()))
        .decorations(false)
        .transparent(true)
        .general_autofill_enabled(false)
        .on_new_window(open_links_externally)
        .visible(false);

    match browser_args(app) {
        Some(args) => builder.additional_browser_args(&args),
        None => builder,
    }
}

// WebView2 154+ ignores WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS once a host passes its own arguments
#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn browser_args<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    app.config()
        .app
        .windows
        .iter()
        .find_map(|window| window.additional_browser_args.clone())
        .or_else(dev_browser_args)
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn dev_browser_args() -> Option<String> {
    if CHANNEL != Channel::Dev {
        return None;
    }

    std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS")
        .ok()
        .filter(|args| !args.trim().is_empty())
}

pub fn open_links_externally<R: Runtime>(url: Url, _: NewWindowFeatures) -> NewWindowResponse<R> {
    if LINK_SCHEMES.contains(&url.scheme()) {
        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
    }

    NewWindowResponse::Deny
}
