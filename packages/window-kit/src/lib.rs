use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

use tauri::webview::{NewWindowFeatures, NewWindowResponse};
use tauri::{AppHandle, Runtime, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const LINK_SCHEMES: [&str; 3] = ["http", "https", "mailto"];

static NEXT: AtomicU32 = AtomicU32::new(1);

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

        builder.build().inspect_err(|_| {
            self.0.lock().unwrap().remove(label);
        })
    }
}

pub fn label(prefix: &str) -> String {
    format!("{prefix}-{}", NEXT.fetch_add(1, Ordering::Relaxed))
}

// windows only join the host's WebView2 browser process when their arguments match
pub fn child<'a, R: Runtime>(
    app: &'a AppHandle<R>,
    label: &str,
    route: &str,
) -> WebviewWindowBuilder<'a, R, AppHandle<R>> {
    let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(route.into()))
        .decorations(false)
        .transparent(true)
        .general_autofill_enabled(false)
        .on_new_window(open_links_externally)
        .visible(false);

    let shared = app
        .config()
        .app
        .windows
        .iter()
        .find_map(|window| window.additional_browser_args.clone());

    match shared {
        Some(args) => builder.additional_browser_args(&args),
        None => builder,
    }
}

pub fn open_links_externally<R: Runtime>(url: Url, _: NewWindowFeatures) -> NewWindowResponse<R> {
    if LINK_SCHEMES.contains(&url.scheme()) {
        let _ = tauri_plugin_opener::open_url(url.as_str(), None::<&str>);
    }

    NewWindowResponse::Deny
}
