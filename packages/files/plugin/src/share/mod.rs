mod browse;
pub mod commands;
mod net;
mod peers;
mod store;
mod wire;

use std::fs::File;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use iroh::EndpointId;
use tauri::AppHandle;
#[cfg(desktop)]
use tauri::Manager;
use tokio::sync::OnceCell;

use crate::error::Result;
use net::Net;
use store::Saved;

struct Node {
    id: EndpointId,
    dir: PathBuf,
    app: AppHandle,
    saved: Mutex<Saved>,
    invite: Mutex<Option<([u8; 32], Instant)>>,
    pending_pair: Mutex<Option<String>>,
    attention: AtomicBool,
    net: OnceCell<Net>,
    gate: Mutex<browse::Gate>,
    _lock: File,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|since| since.as_millis() as u64)
        .unwrap_or_default()
}

fn node(app: &AppHandle) -> Result<Arc<Node>> {
    static NODE: Mutex<Option<Arc<Node>>> = Mutex::new(None);

    let mut slot = NODE.lock().unwrap();

    if let Some(node) = slot.as_ref() {
        return Ok(node.clone());
    }

    let node = Arc::new(Node::load(app)?);

    #[cfg(desktop)]
    if let Some(links) = app.try_state::<tauri_plugin_deep_link::DeepLink<tauri::Wry>>() {
        let _ = links.register(wire::SCHEME);
    }

    node.resume();
    *slot = Some(node.clone());

    Ok(node)
}

impl Node {
    fn resume(self: &Arc<Self>) {
        if self.lock().devices.is_empty() {
            return;
        }

        let node = self.clone();

        tauri::async_runtime::spawn(async move {
            let _ = node.net().await;
        });
    }
}

pub fn endpoint_id(app: &AppHandle) -> Option<String> {
    node(app).ok().map(|node| node.id.to_string())
}

pub fn start(app: &AppHandle) {
    #[cfg(mobile)]
    {
        use tauri_plugin_deep_link::DeepLinkExt;

        use tauri::Manager;

        let scope = app.asset_protocol_scope();

        for root in browse::drives() {
            let _ = scope.allow_directory(root, true);
        }

        if let Ok(cache) = app.path().app_cache_dir() {
            let _ = scope.allow_directory(cache, true);
        }

        let window = app.clone();

        // plugin setup runs while Tauri holds the plugin store lock, and building a webview takes it again
        tauri::async_runtime::spawn(async move {
            let _ = tauri::WebviewWindowBuilder::new(
                &window,
                "files-mobile",
                tauri::WebviewUrl::App("mobile".into()),
            )
            .build();
        });

        let handle = app.clone();

        app.deep_link().on_open_url(move |event| {
            let links: Vec<String> = event.urls().iter().map(|url| url.to_string()).collect();

            open_links(&handle, links);
        });
    }

    let _ = node(app);
}

fn open_links(app: &AppHandle, links: Vec<String>) {
    let Ok(node) = node(app) else {
        return;
    };

    for code in links.iter().filter_map(|link| wire::parse_link(link)) {
        node.prompt_pair(code);
    }
}

#[cfg(desktop)]
pub fn take_links(app: &AppHandle, args: &mut Vec<String>) -> bool {
    let (links, rest): (Vec<String>, Vec<String>) = std::mem::take(args)
        .into_iter()
        .partition(|arg| wire::is_link(arg));

    *args = rest;

    let found = !links.is_empty();

    open_links(app, links);

    found
}

#[cfg(desktop)]
pub fn focus_window(app: &AppHandle) -> bool {
    let window = app.webview_windows().into_values().find(|window| {
        window.label().starts_with("files-") && window.label() != crate::menu::LABEL
    });

    window.is_some_and(|window| {
        #[cfg(desktop)]
        let _ = window.unminimize();

        window.set_focus().is_ok()
    })
}
