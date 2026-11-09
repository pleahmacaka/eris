use std::fs::{OpenOptions, TryLockError};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::{Mutex, MutexGuard};

use iroh::{EndpointId, SecretKey};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::OnceCell;

use super::browse::{Browse, Member};
use super::peers::{default_name, Device};
use super::wire::{self, fail};
use super::Node;
use crate::error::{Error, Result};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Saved {
    pub(super) key: [u8; 32],
    pub(super) name: String,
    pub(super) devices: Vec<Device>,
    #[serde(default)]
    pub(super) browse: Browse,
}

impl Saved {
    fn fresh() -> Self {
        Self {
            key: SecretKey::generate().to_bytes(),
            name: default_name(),
            devices: Vec::new(),
            browse: Browse::default(),
        }
    }

    pub(super) fn knows(&self, peer: &EndpointId) -> bool {
        self.devices.iter().any(|device| device.id == *peer)
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
pub struct State {
    name: String,
    devices: Vec<Device>,
    pending_pair: Option<String>,
    senior: bool,
    browse: Browse,
    browse_asks: Vec<Member>,
    members: Vec<Member>,
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

// Eris and Eris Files run side by side and each holds its own node, so the desktop host keeps a separate store
fn node_dir(app: &AppHandle) -> Result<PathBuf> {
    let base = crate::data_dir(app)?;
    let embedded = app
        .try_state::<crate::Host>()
        .is_some_and(|host| host.marker.is_some());

    Ok(if embedded { base.join("eris") } else { base })
}

impl Node {
    pub(super) fn load(app: &AppHandle) -> Result<Self> {
        let dir = node_dir(app)?;

        std::fs::create_dir_all(&dir)?;

        let lock = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(false)
            .open(dir.join("share.lock"))?;

        match lock.try_lock() {
            Ok(()) => {}
            // std has no file locks on Android, where the store has one app process anyway
            Err(TryLockError::Error(error)) if error.kind() == ErrorKind::Unsupported => {}
            Err(_) => return Err(Error::Busy),
        }

        let saved = read_saved(&dir.join("share.json"))?.unwrap_or_else(Saved::fresh);

        Ok(Self {
            id: SecretKey::from_bytes(&saved.key).public(),
            dir,
            app: app.clone(),
            saved: Mutex::new(saved),
            invite: Mutex::new(None),
            pending_pair: Mutex::new(None),
            attention: AtomicBool::new(false),
            net: OnceCell::new(),
            gate: Mutex::default(),
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

    pub(super) fn state(&self) -> State {
        let pending_pair = self.pending_pair.lock().unwrap().clone();
        let browse_asks = self.browse_asks();
        let members = self.browse_members();
        let saved = self.lock();

        State {
            name: saved.name.clone(),
            devices: saved.devices.clone(),
            pending_pair,
            senior: saved.senior(),
            browse: saved.browse.clone(),
            browse_asks,
            members,
        }
    }
}
