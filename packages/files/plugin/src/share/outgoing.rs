use std::path::{Path, PathBuf};
use std::sync::Arc;

use iroh::EndpointId;
use iroh_blobs::api::blobs::{AddPathOptions, ImportMode};
use iroh_blobs::format::collection::Collection;
use iroh_blobs::{BlobFormat, Hash};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::store::ShareView;
use super::wire::{fail, Item, Manifest, Reply, Request};
use super::{now, Node};
use crate::error::{Error, Result};

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Download {
    device: EndpointId,
    at: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Outgoing {
    pub(super) id: Uuid,
    pub(super) hash: Hash,
    items: Vec<Item>,
    total: u64,
    created_at: u64,
    public: bool,
    pub(super) devices: Vec<EndpointId>,
    expires_at: Option<u64>,
    downloads: Vec<Download>,
}

impl Outgoing {
    fn expired(&self) -> bool {
        self.expires_at.is_some_and(|at| at <= now())
    }

    pub(super) fn reaches(&self, peer: &EndpointId) -> bool {
        !self.expired() && (self.public || self.devices.contains(peer))
    }

    pub(super) fn orphaned(&self) -> bool {
        !self.public && self.devices.is_empty()
    }
}

type Gathered = (Vec<(String, PathBuf)>, Vec<Item>);

fn gather(paths: &[PathBuf]) -> Result<Gathered> {
    let mut files = Vec::new();
    let mut items = Vec::new();

    for path in paths {
        let name = path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .ok_or(Error::Unsupported)?;
        let meta = std::fs::symlink_metadata(path)?;
        let before = files.len();

        if meta.is_dir() {
            walk(path, &name, &mut files)?;
        } else if meta.is_file() {
            files.push((name.clone(), path.clone(), meta.len()));
        }

        let added = &files[before..];

        items.push(Item {
            name,
            size: added.iter().map(|(_, _, size)| size).sum(),
            files: added.len() as u64,
            dir: meta.is_dir(),
        });
    }

    let files = files
        .into_iter()
        .map(|(name, path, _)| (name, path))
        .collect();

    Ok((files, items))
}

fn walk(dir: &Path, prefix: &str, files: &mut Vec<(String, PathBuf, u64)>) -> Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let meta = std::fs::symlink_metadata(entry.path())?;
        let name = format!("{prefix}/{}", entry.file_name().to_string_lossy());

        if meta.is_dir() {
            walk(&entry.path(), &name, files)?;
        } else if meta.is_file() {
            files.push((name, entry.path(), meta.len()));
        }
    }

    Ok(())
}

impl Node {
    pub(super) fn purge(&self) {
        let expired: Vec<Outgoing> = {
            let saved = self.lock();

            saved
                .shares
                .iter()
                .filter(|share| share.expired())
                .cloned()
                .collect()
        };

        if expired.is_empty() {
            return;
        }

        let _ = self.update(|saved| saved.shares.retain(|share| !share.expired()));

        for share in &expired {
            self.forget(share);
        }
    }

    pub(super) fn forget(&self, share: &Outgoing) {
        if let Some(net) = self.net.get() {
            let store = net.store.clone();
            let tag = format!("share-{}", share.id);

            tauri::async_runtime::spawn(async move {
                let _ = store.tags().delete(tag).await;
            });
        }
    }

    pub(super) async fn create(
        self: &Arc<Self>,
        paths: Vec<PathBuf>,
        expires_at: Option<u64>,
    ) -> Result<ShareView> {
        let (files, items) = tauri::async_runtime::spawn_blocking(move || gather(&paths))
            .await
            .map_err(fail)??;

        if files.is_empty() {
            return Err(Error::Empty);
        }

        let net = self.net().await?;
        let batch = net.store.batch().await.map_err(fail)?;
        let mut entries = Vec::with_capacity(files.len());
        let mut held = Vec::with_capacity(files.len());

        for (name, path) in files {
            let tag = batch
                .add_path_with_opts(AddPathOptions {
                    path,
                    format: BlobFormat::Raw,
                    mode: ImportMode::TryReference,
                })
                .await
                .map_err(fail)?;

            entries.push((name, tag.hash()));
            held.push(tag);
        }

        let id = Uuid::new_v4();
        let root = Collection::from_iter(entries)
            .store(&net.store)
            .await
            .map_err(fail)?;

        net.store
            .tags()
            .set(format!("share-{id}"), root.hash_and_format())
            .await
            .map_err(fail)?;

        drop(held);

        let share = Outgoing {
            id,
            hash: root.hash(),
            total: items.iter().map(|item| item.size).sum(),
            items,
            created_at: now(),
            public: false,
            devices: Vec::new(),
            expires_at,
            downloads: Vec::new(),
        };

        self.update(|saved| saved.shares.insert(0, share.clone()))?;

        Ok(self.view(share))
    }

    fn edit(&self, id: Uuid, change: impl FnOnce(&mut Outgoing)) -> Result<()> {
        self.update(|saved| {
            if let Some(share) = saved.shares.iter_mut().find(|share| share.id == id) {
                change(share);
            }
        })
    }

    pub(super) fn set_public(&self, id: Uuid, public: bool) -> Result<()> {
        self.edit(id, |share| share.public = public)?;

        if self.lock().share(id).is_some_and(Outgoing::orphaned) {
            self.revoke(id)?;
        }

        Ok(())
    }

    pub(super) fn set_expiry(&self, id: Uuid, expires_at: Option<u64>) -> Result<()> {
        self.edit(id, |share| share.expires_at = expires_at)
    }

    pub(super) async fn offer(self: &Arc<Self>, id: Uuid, device: EndpointId) -> Result<()> {
        if !self.knows(&device) {
            return Err(Error::Unpaired);
        }

        if self.lock().share(id).is_none() {
            return Err(Error::Missing);
        }

        self.edit(id, |share| {
            if !share.devices.contains(&device) {
                share.devices.push(device);
            }
        })?;

        match self.call(device, Request::Offer { share: id }).await {
            Ok(Reply::Accepted) => Ok(()),
            outcome => {
                self.edit(id, |share| share.devices.retain(|known| *known != device))?;

                Err(match outcome {
                    Err(error) => error,
                    Ok(_) => Error::Denied,
                })
            }
        }
    }

    pub(super) fn revoke(&self, id: Uuid) -> Result<()> {
        let removed = self.update(|saved| {
            let index = saved.shares.iter().position(|share| share.id == id)?;

            Some(saved.shares.remove(index))
        })?;

        if let Some(share) = removed {
            self.forget(&share);
        }

        Ok(())
    }

    pub(super) fn manifest_for(&self, remote: &EndpointId, id: Uuid) -> Reply {
        self.purge();

        let saved = self.lock();

        match saved.share(id).filter(|share| share.reaches(remote)) {
            Some(share) => Reply::Manifest {
                manifest: Manifest {
                    hash: share.hash,
                    items: share.items.clone(),
                    total: share.total,
                    from: saved.name.clone(),
                },
            },
            None => Reply::Denied,
        }
    }

    pub(super) fn record_download(&self, remote: EndpointId, id: Uuid) -> Reply {
        let reached = self
            .lock()
            .share(id)
            .is_some_and(|share| share.reaches(&remote));

        if !reached {
            return Reply::Denied;
        }

        let _ = self.update(|saved| {
            if let Some(share) = saved.shares.iter_mut().find(|share| share.id == id) {
                share.downloads.retain(|entry| entry.device != remote);
                share.downloads.insert(
                    0,
                    Download {
                        device: remote,
                        at: now(),
                    },
                );
            }
        });

        Reply::Accepted
    }
}
