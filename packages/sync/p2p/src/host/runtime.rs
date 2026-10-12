//! Process-wide node initialization and the Tauri event sink.

use std::sync::{Arc, OnceLock};

use tauri::{AppHandle, Emitter, Manager};

use crate::node::{Event, Node, Sink, FILES};
use crate::protocol::fail;

static NODE: OnceLock<Result<Arc<Node>, String>> = OnceLock::new();

pub fn set_files(id: String) {
    let _ = FILES.set(id);
}

pub fn members(app: &AppHandle) -> Vec<(String, String)> {
    let Ok(node) = node(app) else {
        return Vec::new();
    };

    let saved = node.lock();

    if saved.chain.is_none() {
        return Vec::new();
    }

    saved
        .peers
        .iter()
        .filter_map(|peer| Some((peer.files.clone()?, peer.name.clone())))
        .collect()
}

pub(super) fn node(app: &AppHandle) -> Result<&'static Arc<Node>, String> {
    if let Some(node) = NODE.get() {
        return node.as_ref().map_err(Clone::clone);
    }

    let dir = app.path().app_data_dir().map_err(fail)?;
    let app = app.clone();

    let sink: Sink = Box::new(move |event| {
        let _ = match event {
            Event::Snapshot(snapshot) => app.emit("p2p-snapshot", snapshot),
            Event::Peers => app.emit("p2p-peers", ()),
        };
    });

    NODE.get_or_init(|| Node::open(&dir, sink).map(Arc::new))
        .as_ref()
        .map_err(Clone::clone)
}

pub fn start(app: &AppHandle) {
    let Ok(node) = node(app) else {
        return;
    };

    if node.paired() {
        tauri::async_runtime::spawn(async move {
            let _ = node.endpoint().await;
        });
    }
}
