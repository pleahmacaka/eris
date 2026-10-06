use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant, UNIX_EPOCH};

use iroh::EndpointId;
use iroh_blobs::api::blobs::{AddPathOptions, ImportMode};
use iroh_blobs::api::downloader::Shuffled;
use iroh_blobs::{BlobFormat, Hash, HashAndFormat};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use super::wire::{self, fail, RemoteEntry, Reply};
use super::Node;
use crate::error::{Error, Result};

const ONCE: Duration = Duration::from_secs(60 * 60);
const ASK_TTL: Duration = Duration::from_secs(120);
const HOLD: Duration = Duration::from_secs(10 * 60);
const ENTRY_LIMIT: usize = 5_000;

#[derive(Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Scope {
    #[default]
    Drives,
    Home,
    Folders,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Browse {
    pub(super) scope: Scope,
    pub(super) folders: Vec<String>,
    pub(super) always: Vec<EndpointId>,
}

#[derive(Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Answer {
    Once,
    Always,
    Deny,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Member {
    id: EndpointId,
    name: String,
}

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Browsed {
    Listing {
        path: Option<String>,
        entries: Vec<RemoteEntry>,
    },
    Pending,
    Denied,
}

enum Prep {
    Busy,
    Ready(Hash, u64),
    Failed,
}

#[derive(Default)]
pub(super) struct Gate {
    once: HashMap<EndpointId, Instant>,
    asks: HashMap<EndpointId, Instant>,
    denied: HashMap<EndpointId, Instant>,
    held: HashMap<EndpointId, HashSet<Hash>>,
    preparing: HashMap<(EndpointId, PathBuf), Prep>,
}

impl Gate {
    pub(super) fn holds(&self, peer: &EndpointId, hash: &Hash) -> bool {
        self.held.get(peer).is_some_and(|held| held.contains(hash))
    }

    pub(super) fn forget(&mut self, peer: &EndpointId) {
        self.once.remove(peer);
        self.asks.remove(peer);
        self.held.remove(peer);
    }
}

fn label(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.to_string_lossy().into_owned())
}

#[cfg(windows)]
fn drives() -> Vec<PathBuf> {
    ('A'..='Z')
        .map(|letter| PathBuf::from(format!("{letter}:\\")))
        .filter(|root| root.is_dir())
        .collect()
}

#[cfg(target_os = "android")]
fn drives() -> Vec<PathBuf> {
    vec![PathBuf::from("/storage/emulated/0")]
}

#[cfg(all(unix, not(target_os = "android")))]
fn drives() -> Vec<PathBuf> {
    vec![PathBuf::from("/")]
}

fn home(app: &AppHandle) -> Vec<PathBuf> {
    let path = app.path();

    [
        path.desktop_dir(),
        path.document_dir(),
        path.download_dir(),
        path.picture_dir(),
        path.audio_dir(),
        path.video_dir(),
    ]
    .into_iter()
    .flatten()
    .collect()
}

fn millis(meta: &std::fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |since| since.as_millis() as u64)
}

fn listing(dir: &Path, shown: &Path) -> Result<Vec<RemoteEntry>> {
    let mut entries = Vec::new();

    for entry in std::fs::read_dir(dir)?.flatten().take(ENTRY_LIMIT) {
        let Ok(meta) = entry.metadata() else {
            continue;
        };

        let name = entry.file_name().to_string_lossy().into_owned();
        let dir = meta.is_dir();

        entries.push(RemoteEntry {
            path: shown.join(&name).to_string_lossy().into_owned(),
            name,
            dir,
            size: if dir { 0 } else { meta.len() },
            modified: millis(&meta),
        });
    }

    entries.sort_by(|a, b| {
        b.dir
            .cmp(&a.dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

fn saved_name(name: &str) -> String {
    wire::safe_relative(&label(Path::new(name)))
        .filter(|path| path.components().count() == 1)
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".into())
}

pub(super) fn members(app: &AppHandle) -> Vec<(EndpointId, String)> {
    let Some(peers) = app.try_state::<crate::Host>().and_then(|host| host.peers) else {
        return Vec::new();
    };

    peers(app)
        .into_iter()
        .filter_map(|(id, name)| Some((id.parse().ok()?, name)))
        .collect()
}

impl Node {
    fn gate(&self) -> std::sync::MutexGuard<'_, Gate> {
        self.gate.lock().unwrap()
    }

    pub(super) fn member_name(&self, peer: &EndpointId) -> Option<String> {
        let paired = self
            .lock()
            .devices
            .iter()
            .find(|device| device.id == *peer)
            .map(|device| device.name.clone());

        paired.or_else(|| {
            members(&self.app)
                .into_iter()
                .find(|(id, _)| id == peer)
                .map(|(_, name)| name)
        })
    }

    pub(super) fn browse_members(&self) -> Vec<Member> {
        let saved = self.lock();

        members(&self.app)
            .into_iter()
            .filter(|(id, _)| *id != self.id && !saved.knows(id))
            .map(|(id, name)| Member { id, name })
            .collect()
    }

    pub(super) fn browse_asks(&self) -> Vec<Member> {
        let mut gate = self.gate();

        gate.asks.retain(|_, at| at.elapsed() < ASK_TTL);

        let asking: Vec<EndpointId> = gate.asks.keys().copied().collect();

        drop(gate);

        asking
            .into_iter()
            .filter_map(|id| Some(Member { name: self.member_name(&id)?, id }))
            .collect()
    }

    fn granted(&self, peer: &EndpointId) -> bool {
        self.lock().browse.always.contains(peer)
            || self
                .gate()
                .once
                .get(peer)
                .is_some_and(|at| at.elapsed() < ONCE)
    }

    fn check(&self, peer: EndpointId) -> Option<Reply> {
        if self.member_name(&peer).is_none() {
            return Some(Reply::Denied);
        }

        if self
            .gate()
            .denied
            .get(&peer)
            .is_some_and(|at| at.elapsed() < ASK_TTL)
        {
            return Some(Reply::Denied);
        }

        if self.granted(&peer) {
            return None;
        }

        let fresh = self.gate().asks.insert(peer, Instant::now()).is_none();

        if fresh {
            self.attention.store(true, Ordering::Relaxed);
            self.changed();
        }

        Some(Reply::Pending)
    }

    fn roots(&self) -> Vec<PathBuf> {
        let browse = self.lock().browse.clone();

        let roots = match browse.scope {
            Scope::Drives => drives(),
            Scope::Home => home(&self.app),
            Scope::Folders => browse.folders.iter().map(PathBuf::from).collect(),
        };

        roots.into_iter().filter(|root| root.is_dir()).collect()
    }

    // canonical paths only, so a link or a ".." inside a shared root cannot reach outside it
    fn allowed(&self, path: &str) -> Option<PathBuf> {
        let target = Path::new(path).canonicalize().ok()?;

        self.roots()
            .iter()
            .filter_map(|root| root.canonicalize().ok())
            .any(|root| target.starts_with(root))
            .then_some(target)
    }

    pub(super) async fn browsed(self: &Arc<Self>, remote: EndpointId, path: Option<String>) -> Reply {
        if let Some(reply) = self.check(remote) {
            return reply;
        }

        let Some(path) = path else {
            let entries = self
                .roots()
                .into_iter()
                .map(|root| RemoteEntry {
                    name: label(&root),
                    path: root.to_string_lossy().into_owned(),
                    dir: true,
                    size: 0,
                    modified: 0,
                })
                .collect();

            return Reply::Listing {
                path: None,
                entries,
            };
        };

        let Some(dir) = self.allowed(&path) else {
            return Reply::Denied;
        };

        let shown = PathBuf::from(&path);

        match tauri::async_runtime::spawn_blocking(move || listing(&dir, &shown)).await {
            Ok(Ok(entries)) => Reply::Listing {
                path: Some(path),
                entries,
            },
            _ => Reply::Denied,
        }
    }

    pub(super) async fn fetched(self: &Arc<Self>, remote: EndpointId, path: String) -> Reply {
        if let Some(reply) = self.check(remote) {
            return reply;
        }

        let Some(file) = self.allowed(&path).filter(|file| file.is_file()) else {
            return Reply::Denied;
        };

        let key = (remote, file.clone());

        let state = {
            let mut gate = self.gate();

            match gate.preparing.get(&key) {
                Some(Prep::Ready(hash, size)) => Some(Ok((*hash, *size))),
                Some(Prep::Failed) => {
                    gate.preparing.remove(&key);

                    Some(Err(()))
                }
                Some(Prep::Busy) => None,
                None => {
                    gate.preparing.insert(key.clone(), Prep::Busy);

                    let node = self.clone();

                    tauri::async_runtime::spawn(async move {
                        let prepared = node.hold(remote, &file).await;

                        node.gate().preparing.insert(
                            key,
                            match prepared {
                                Ok((hash, size)) => Prep::Ready(hash, size),
                                Err(_) => Prep::Failed,
                            },
                        );
                    });

                    None
                }
            }
        };

        match state {
            Some(Ok((hash, size))) => Reply::Blob {
                hash,
                size,
                name: label(Path::new(&path)),
            },
            Some(Err(())) => Reply::Denied,
            None => Reply::Pending,
        }
    }

    // ponytail: a fetched file stays servable for a fixed window, then its tag goes; re-fetching starts over
    async fn hold(self: &Arc<Self>, peer: EndpointId, file: &Path) -> Result<(Hash, u64)> {
        let size = std::fs::metadata(file)?.len();
        let net = self.net().await?;
        let batch = net.store.batch().await.map_err(fail)?;

        let tag = batch
            .add_path_with_opts(AddPathOptions {
                path: file.to_path_buf(),
                format: BlobFormat::Raw,
                mode: ImportMode::TryReference,
            })
            .await
            .map_err(fail)?;

        let hash = tag.hash();
        let name = format!("browse-{hash}");

        net.store
            .tags()
            .set(name.clone(), HashAndFormat::raw(hash))
            .await
            .map_err(fail)?;

        drop(tag);

        self.gate().held.entry(peer).or_default().insert(hash);

        let node = self.clone();
        let key = (peer, file.to_path_buf());

        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(HOLD).await;

            {
                let mut gate = node.gate();

                gate.preparing.remove(&key);

                if let Some(held) = gate.held.get_mut(&peer) {
                    held.remove(&hash);
                }
            }

            if let Some(net) = node.net.get() {
                let _ = net.store.tags().delete(name).await;
            }
        });

        Ok((hash, size))
    }

    pub(super) fn answer_browse(&self, peer: EndpointId, answer: Answer) -> Result<()> {
        self.gate().asks.remove(&peer);

        match answer {
            Answer::Once => {
                self.gate().once.insert(peer, Instant::now());
            }
            Answer::Always => {
                return self.update(|saved| {
                    if !saved.browse.always.contains(&peer) {
                        saved.browse.always.push(peer);
                    }
                });
            }
            Answer::Deny => {
                self.gate().denied.insert(peer, Instant::now());
            }
        }

        self.changed();

        Ok(())
    }

    pub(super) fn revoke_browse(&self, peer: EndpointId) -> Result<()> {
        self.gate().forget(&peer);
        self.update(|saved| saved.browse.always.retain(|known| *known != peer))
    }

    pub(super) fn browse_scope(&self, scope: Scope, folders: Vec<String>) -> Result<()> {
        self.update(|saved| {
            saved.browse.scope = scope;
            saved.browse.folders = folders;
        })
    }

    pub(super) async fn save_remote(
        &self,
        peer: EndpointId,
        hash: Hash,
        name: &str,
        folder: &Path,
    ) -> Result<String> {
        let net = self.net.get().ok_or(Error::Unreachable)?;

        net.downloader
            .download(HashAndFormat::raw(hash), Shuffled::new(vec![peer]))
            .await
            .map_err(fail)?;

        std::fs::create_dir_all(folder)?;

        let target = wire::vacant(folder, &saved_name(name));

        net.store
            .blobs()
            .export(hash, &target)
            .await
            .map_err(fail)?;

        Ok(target.to_string_lossy().into_owned())
    }
}
