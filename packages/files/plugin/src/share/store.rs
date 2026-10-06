use std::collections::HashSet;
use std::fs::OpenOptions;
use std::io::ErrorKind;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::{Mutex, MutexGuard};

use iroh::{EndpointId, SecretKey};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tokio::sync::OnceCell;
use uuid::Uuid;

use super::incoming::{Incoming, IncomingView};
use super::outgoing::Outgoing;
use super::peers::{default_name, Device};
use super::sync::{Sync, SyncInvite};
use super::wire::{self, fail};
use super::Node;
use crate::error::{Error, Result};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Saved {
    pub(super) key: [u8; 32],
    pub(super) name: String,
    pub(super) devices: Vec<Device>,
    pub(super) shares: Vec<Outgoing>,
    pub(super) inbox: Vec<Incoming>,
    pub(super) syncs: Vec<Sync>,
    pub(super) sync_invites: Vec<SyncInvite>,
}

impl Saved {
    fn fresh() -> Self {
        Self {
            key: SecretKey::generate().to_bytes(),
            name: default_name(),
            devices: Vec::new(),
            shares: Vec::new(),
            inbox: Vec::new(),
            syncs: Vec::new(),
            sync_invites: Vec::new(),
        }
    }

    pub(super) fn knows(&self, peer: &EndpointId) -> bool {
        self.devices.iter().any(|device| device.id == *peer)
    }

    pub(super) fn share(&self, id: Uuid) -> Option<&Outgoing> {
        self.shares.iter().find(|share| share.id == id)
    }

    pub(super) fn added_at(&self, peer: &EndpointId) -> Option<u64> {
        self.devices
            .iter()
            .find(|device| device.id == *peer)
            .map(|device| device.added_at)
    }

    pub(super) fn senior(&self) -> bool {
        self.devices
            .iter()
            .map(|device| device.added_at)
            .min()
            .is_some_and(|since| super::now().saturating_sub(since) >= super::peers::SENIORITY)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShareView {
    #[serde(flatten)]
    share: Outgoing,
    link: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct State {
    name: String,
    devices: Vec<Device>,
    shares: Vec<ShareView>,
    inbox: Vec<IncomingView>,
    pending_pair: Option<String>,
    syncs: Vec<Sync>,
    sync_invites: Vec<SyncInvite>,
    senior: bool,
}

fn read_saved(file: &Path) -> Result<Option<Saved>> {
    let bytes = match std::fs::read(file) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };

    if let Ok(saved) = serde_json::from_slice(&bytes) {
        return Ok(Some(saved));
    }

    let folder = file.parent().ok_or(Error::Invalid)?;

    std::fs::rename(file, wire::vacant(folder, "share.json.bad"))?;

    Ok(None)
}

impl Node {
    pub(super) fn load(app: &AppHandle) -> Result<Self> {
        let dir = crate::data_dir(app)?;

        std::fs::create_dir_all(&dir)?;

        let lock = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(false)
            .open(dir.join("share.lock"))?;

        lock.try_lock().map_err(|_| Error::Busy)?;

        let saved = read_saved(&dir.join("share.json"))?.unwrap_or_else(Saved::fresh);

        Ok(Self {
            id: SecretKey::from_bytes(&saved.key).public(),
            dir,
            app: app.clone(),
            saved: Mutex::new(saved),
            invite: Mutex::new(None),
            pending_pair: Mutex::new(None),
            attention: AtomicBool::new(false),
            fetching: Mutex::new(HashSet::new()),
            transfers: Mutex::default(),
            net: OnceCell::new(),
            slots: Mutex::default(),
            sync_hashes: Mutex::default(),
            _lock: lock,
        })
    }

    pub(super) fn lock(&self) -> MutexGuard<'_, Saved> {
        self.saved.lock().unwrap()
    }

    fn persist(&self, saved: &Saved) -> Result<()> {
        let file = self.dir.join("share.json");
        let staging = file.with_extension("json.tmp");

        std::fs::write(&staging, serde_json::to_vec(saved).map_err(fail)?)?;
        std::fs::rename(staging, file)?;

        Ok(())
    }

    pub(super) fn changed(&self) {
        let _ = self.app.emit("share-changed", ());
    }

    pub(super) fn update<T>(&self, change: impl FnOnce(&mut Saved) -> T) -> Result<T> {
        let (value, stored) = {
            let mut saved = self.lock();
            let value = change(&mut saved);

            (value, self.persist(&saved))
        };

        self.changed();

        stored.map(|_| value)
    }

    pub(super) fn view(&self, share: Outgoing) -> ShareView {
        ShareView {
            link: wire::share_link(&share.id, &self.id),
            share,
        }
    }

    pub(super) fn state(&self) -> State {
        self.purge();

        let fetching = self.fetching.lock().unwrap().clone();
        let receiving: HashSet<Uuid> = self.transfers.lock().unwrap().keys().copied().collect();
        let pending_pair = self.pending_pair.lock().unwrap().clone();
        let saved = self.lock();

        State {
            name: saved.name.clone(),
            devices: saved.devices.clone(),
            shares: saved
                .shares
                .iter()
                .map(|share| self.view(share.clone()))
                .collect(),
            inbox: saved
                .inbox
                .iter()
                .map(|entry| entry.view(&fetching, &receiving))
                .collect(),
            pending_pair,
            syncs: saved.syncs.clone(),
            sync_invites: saved.sync_invites.clone(),
            senior: saved.senior(),
        }
    }
}
