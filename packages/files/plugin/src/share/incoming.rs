use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};

use iroh::EndpointId;
use iroh_blobs::api::blobs::{ExportMode, ExportOptions};
use iroh_blobs::api::downloader::{DownloadProgressItem, Shuffled};
use iroh_blobs::format::collection::Collection;
use iroh_blobs::{Hash, HashAndFormat};
use n0_future::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;

use super::wire::{self, fail, Link, Manifest, Reply, Request};
use super::{now, Node};
use crate::error::{Error, Result};

const PROGRESS_EVERY: Duration = Duration::from_millis(120);

#[derive(Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum Stage {
    Offline,
    Ready,
    Done,
    Failed,
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
enum Phase {
    Waiting,
    Receiving,
    Offline,
    Ready,
    Done,
    Failed,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Incoming {
    pub(super) id: Uuid,
    pub(super) from: EndpointId,
    manifest: Option<Manifest>,
    stage: Stage,
    received_at: u64,
    saved_to: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingView {
    #[serde(flatten)]
    entry: Incoming,
    phase: Phase,
}

impl Incoming {
    pub(super) fn view(&self, fetching: &HashSet<Uuid>, receiving: &HashSet<Uuid>) -> IncomingView {
        let phase = if receiving.contains(&self.id) {
            Phase::Receiving
        } else if fetching.contains(&self.id) {
            Phase::Waiting
        } else {
            match self.stage {
                Stage::Offline => Phase::Offline,
                Stage::Ready => Phase::Ready,
                Stage::Done => Phase::Done,
                Stage::Failed => Phase::Failed,
            }
        };

        IncomingView {
            entry: self.clone(),
            phase,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    id: Uuid,
    done: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEntry {
    name: String,
    path: String,
    dir: bool,
    size: u64,
}

pub(super) fn received_root(app: &AppHandle) -> Result<PathBuf> {
    app.path()
        .download_dir()
        .or_else(|_| crate::data_dir(app).map(|dir| dir.join("received")))
        .map_err(Error::from)
}

pub(super) fn received_files(root: &Path, sub: Option<String>) -> Result<Vec<LocalEntry>> {
    let dir = match sub.filter(|sub| !sub.is_empty()) {
        Some(sub) => root.join(wire::safe_relative(&sub).ok_or(Error::Invalid)?),
        None => root.to_path_buf(),
    };

    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Ok(Vec::new());
    };

    let mut listed: Vec<LocalEntry> = entries
        .filter_map(std::result::Result::ok)
        .filter_map(|entry| {
            let meta = entry.metadata().ok()?;

            Some(LocalEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                path: entry.path().to_string_lossy().into_owned(),
                dir: meta.is_dir(),
                size: meta.len(),
            })
        })
        .collect();

    listed.sort_by(|a, b| b.dir.cmp(&a.dir).then_with(|| a.name.cmp(&b.name)));

    Ok(listed)
}

impl Node {
    fn admit(&self, from: EndpointId, id: Uuid) -> bool {
        {
            let saved = self.lock();

            if let Some(known) = saved.inbox.iter().find(|entry| entry.id == id) {
                return known.from == from;
            }
        }

        let entry = Incoming {
            id,
            from,
            manifest: None,
            stage: Stage::Offline,
            received_at: now(),
            saved_to: None,
            error: None,
        };

        self.attention.store(true, Ordering::Relaxed);
        self.update(|saved| saved.inbox.insert(0, entry)).is_ok()
    }

    pub(super) fn offered(self: &Arc<Self>, from: EndpointId, id: Uuid) -> Reply {
        if !self.admit(from, id) {
            return Reply::Denied;
        }

        let node = self.clone();

        tauri::async_runtime::spawn(async move { node.fetch(id).await });

        Reply::Accepted
    }

    pub(super) async fn open(self: &Arc<Self>, link: Link) {
        match link {
            Link::Pair(code) => self.prompt_pair(code),
            Link::Share { id, from } => {
                if from == self.id || !self.admit(from, id) {
                    return;
                }

                self.attention.store(true, Ordering::Relaxed);

                let _ = self.fetch(id).await;
            }
        }
    }

    pub(super) async fn fetch(self: &Arc<Self>, id: Uuid) -> Result<()> {
        let from = self
            .lock()
            .inbox
            .iter()
            .find(|entry| entry.id == id)
            .map(|entry| entry.from)
            .ok_or(Error::Missing)?;

        if !self.fetching.lock().unwrap().insert(id) {
            return Ok(());
        }

        self.changed();

        let outcome = self.call(from, Request::Ask { share: id }).await;

        self.fetching.lock().unwrap().remove(&id);

        let (stage, manifest, problem) = match outcome {
            Ok(Reply::Manifest { manifest }) => (Stage::Ready, Some(manifest), None),
            Ok(_) => (Stage::Failed, None, Some(Error::Revoked)),
            Err(error) => (Stage::Offline, None, Some(error)),
        };

        let error = problem.as_ref().map(ToString::to_string);

        self.update(|saved| {
            if let Some(entry) = saved.inbox.iter_mut().find(|entry| entry.id == id) {
                entry.stage = stage;
                entry.error = error;

                if manifest.is_some() {
                    entry.manifest = manifest;
                }
            }
        })?;

        problem.map_or(Ok(()), Err)
    }

    pub(super) fn download(self: &Arc<Self>, id: Uuid, folder: PathBuf) -> Result<()> {
        let (hash, from) = {
            let saved = self.lock();
            let entry = saved
                .inbox
                .iter()
                .find(|entry| entry.id == id)
                .ok_or(Error::Missing)?;
            let manifest = entry.manifest.as_ref().ok_or(Error::NotReady)?;

            (manifest.hash, entry.from)
        };

        let mut transfers = self.transfers.lock().unwrap();

        if transfers.contains_key(&id) {
            return Ok(());
        }

        let node = self.clone();

        let task = tauri::async_runtime::spawn(async move {
            let outcome = node.pull(id, hash, from, &folder).await;

            node.transfers.lock().unwrap().remove(&id);

            let _ = node.update(|saved| {
                let Some(entry) = saved.inbox.iter_mut().find(|entry| entry.id == id) else {
                    return;
                };

                match &outcome {
                    Ok(path) => {
                        entry.stage = Stage::Done;
                        entry.saved_to = Some(path.to_string_lossy().into_owned());
                        entry.error = None;
                    }
                    Err(error) => {
                        entry.stage = Stage::Failed;
                        entry.error = Some(error.to_string());
                    }
                }
            });

            if outcome.is_ok() {
                let _ = node.call(from, Request::Received { share: id }).await;
            }
        });

        transfers.insert(id, task);
        drop(transfers);
        self.changed();

        Ok(())
    }

    async fn pull(
        self: &Arc<Self>,
        id: Uuid,
        hash: Hash,
        from: EndpointId,
        folder: &Path,
    ) -> Result<PathBuf> {
        let net = self.net().await?;
        let mut progress = net
            .downloader
            .download(HashAndFormat::hash_seq(hash), Shuffled::new(vec![from]))
            .stream()
            .await
            .map_err(fail)?;

        let mut shown = Instant::now();

        while let Some(item) = progress.next().await {
            match item {
                DownloadProgressItem::Progress(done) if shown.elapsed() >= PROGRESS_EVERY => {
                    shown = Instant::now();

                    let _ = self.app.emit("share-progress", Progress { id, done });
                }
                DownloadProgressItem::Error(error) => return Err(fail(error)),
                DownloadProgressItem::DownloadError => return Err(Error::Unreachable),
                _ => {}
            }
        }

        let collection = Collection::load(hash, net.store.as_ref())
            .await
            .map_err(fail)?;

        std::fs::create_dir_all(folder)?;

        let mut roots: HashMap<String, String> = HashMap::new();
        let mut first = None;

        for (name, child) in collection.iter() {
            let relative = wire::safe_relative(name).ok_or(Error::Invalid)?;
            let mut parts = relative
                .iter()
                .map(|part| part.to_string_lossy().into_owned());
            let top = parts.next().ok_or(Error::Invalid)?;

            let root = roots
                .entry(top.clone())
                .or_insert_with(|| {
                    wire::vacant(folder, &top)
                        .file_name()
                        .map(|name| name.to_string_lossy().into_owned())
                        .unwrap_or(top)
                })
                .clone();

            let target = parts.fold(folder.join(&root), |path, part| path.join(part));

            net.store
                .blobs()
                .export_with_opts(ExportOptions {
                    hash: *child,
                    mode: ExportMode::TryReference,
                    target,
                })
                .await
                .map_err(fail)?;

            first.get_or_insert_with(|| folder.join(&root));
        }

        Ok(match first {
            Some(path) if roots.len() == 1 => path,
            _ => folder.to_path_buf(),
        })
    }

    pub(super) fn cancel(&self, id: Uuid) {
        if let Some(task) = self.transfers.lock().unwrap().remove(&id) {
            task.abort();
            self.changed();
        }
    }

    pub(super) fn dismiss(&self, id: Uuid) -> Result<()> {
        self.cancel(id);
        self.update(|saved| saved.inbox.retain(|entry| entry.id != id))
    }
}
