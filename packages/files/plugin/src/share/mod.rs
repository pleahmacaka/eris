mod browse;
pub mod commands;
mod incoming;
mod net;
mod outgoing;
mod peers;
mod store;
mod sync;
mod wire;

use std::collections::{HashMap, HashSet};
use std::fs::File;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use iroh::EndpointId;
use iroh_blobs::Hash;
use tauri::async_runtime::JoinHandle;
use tauri::AppHandle;
#[cfg(desktop)]
use tauri::Manager;
use tokio::sync::OnceCell;
use uuid::Uuid;

use crate::error::Result;
use net::Net;
use store::Saved;
use sync::Slot;

struct Node {
    id: EndpointId,
    dir: PathBuf,
    app: AppHandle,
    saved: Mutex<Saved>,
    invite: Mutex<Option<([u8; 32], Instant)>>,
    pending_pair: Mutex<Option<String>>,
    attention: AtomicBool,
    fetching: Mutex<HashSet<Uuid>>,
    transfers: Mutex<HashMap<Uuid, JoinHandle<()>>>,
    net: OnceCell<Net>,
    slots: Mutex<HashMap<Uuid, Slot>>,
    sync_hashes: Mutex<HashMap<Uuid, HashSet<Hash>>>,
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
        self.purge();

        let (busy, syncing) = {
            let saved = self.lock();

            (
                !saved.shares.is_empty() || !saved.devices.is_empty(),
                saved.syncs.iter().any(|sync| !sync.paused),
            )
        };

        if busy || syncing {
            let node = self.clone();

            tauri::async_runtime::spawn(async move {
                if node.net().await.is_ok() {
                    node.resume_syncs();
                }
            });
        }
    }
}

pub fn endpoint_id(app: &AppHandle) -> Option<String> {
    node(app).ok().map(|node| node.id.to_string())
}

pub fn start(app: &AppHandle) {
    #[cfg(mobile)]
    {
        use tauri_plugin_deep_link::DeepLinkExt;

        let _ = tauri::WebviewWindowBuilder::new(
            app,
            "files-mobile",
            tauri::WebviewUrl::App("mobile".into()),
        )
        .build();

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

    for link in links.iter().filter_map(|link| wire::parse_link(link)) {
        let node = node.clone();

        tauri::async_runtime::spawn(async move { node.open(link).await });
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
    let window = app
        .webview_windows()
        .into_values()
        .find(|window| window.label().starts_with("files-"));

    window.is_some_and(|window| {
        #[cfg(desktop)]
        let _ = window.unminimize();

        window.set_focus().is_ok()
    })
}
