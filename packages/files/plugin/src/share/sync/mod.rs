mod merge;

use std::collections::{BTreeSet, HashMap};
use std::fs::File;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, UNIX_EPOCH};

use iroh::EndpointId;
use iroh_blobs::api::blobs::{AddPathOptions, ImportMode};
use iroh_blobs::api::downloader::Shuffled;
use iroh_blobs::format::collection::Collection;
use iroh_blobs::{BlobFormat, Hash, HashAndFormat};
use serde::{Deserialize, Serialize};
use tauri::async_runtime::JoinHandle;
use tauri::{AppHandle, Manager};
use tokio::sync::Notify;
use uuid::Uuid;

use super::wire::{self, fail, Entry, Reply, Request};
use super::{now, Node};
use crate::error::{Error, Result};
use merge::{conflict_name, decide, Action};

// editors and installers write in bursts, so react once the folder stays quiet
const SETTLE: Duration = Duration::from_millis(1_500);
const STAGING: &str = ".eris-sync-";

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Sync {
    pub(super) id: Uuid,
    folder: String,
    pub(super) device: EndpointId,
    pub(super) paused: bool,
    linked: bool,
    created_at: u64,
    synced_at: Option<u64>,
    files: u64,
    error: Option<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct SyncInvite {
    id: Uuid,
    pub(super) from: EndpointId,
    name: String,
    received_at: u64,
}

#[derive(Default, Serialize, Deserialize)]
struct Ledger {
    index: HashMap<String, Entry>,
    base: HashMap<String, Hash>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Safety {
    Ok,
    Warn,
    Blocked,
}

pub(super) struct Slot {
    wake: Arc<Notify>,
    watcher: Arc<AtomicBool>,
    task: JoinHandle<()>,
}

fn key(path: &Path) -> String {
    path.to_string_lossy().trim_end_matches('\\').to_lowercase()
}

fn inside(path: &str, root: &str) -> bool {
    path == root || path.starts_with(&format!("{root}\\"))
}

fn env_key(name: &str) -> Option<String> {
    std::env::var(name).ok().map(|value| key(Path::new(&value)))
}

pub(super) fn safety(app: &AppHandle, folder: &Path) -> Safety {
    let path = key(folder);
    let is_root = folder.parent().is_none() || path.len() <= 3;
    let system = [
        "SystemRoot",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "ProgramW6432",
        "ProgramData",
    ]
    .iter()
    .filter_map(|name| env_key(name))
    .any(|root| inside(&path, &root));
    let profile = env_key("USERPROFILE").is_some_and(|root| path == root);
    let own = [app.path().data_dir(), app.path().local_data_dir()]
        .into_iter()
        .filter_map(std::result::Result::ok)
        .map(|dir| key(&dir.join(crate::IDENTIFIER)))
        .any(|data| inside(&path, &data) || inside(&data, &path));

    if is_root || system || profile || own {
        return Safety::Blocked;
    }

    let app_data = ["APPDATA", "LOCALAPPDATA"]
        .iter()
        .filter_map(|name| env_key(name))
        .any(|root| inside(&path, &root) || inside(&root, &path));

    if app_data || path.split('\\').any(|part| part == "appdata") {
        Safety::Warn
    } else {
        Safety::Ok
    }
}

pub(super) fn target_folder(app: &AppHandle, folder: &str) -> Result<PathBuf> {
    let path = PathBuf::from(folder);

    if !path.is_dir() {
        return Err(Error::Missing);
    }

    match safety(app, &path) {
        Safety::Blocked => Err(Error::Blocked),
        _ => Ok(path),
    }
}

fn ignored(name: &str) -> bool {
    let lower = name.to_lowercase();

    lower == "desktop.ini"
        || lower == "thumbs.db"
        || lower.starts_with("~$")
        || lower.ends_with(".tmp")
}

fn millis(meta: &std::fs::Metadata) -> u64 {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|since| since.as_millis() as u64)
        .unwrap_or_default()
}

type Found = Vec<(String, PathBuf, u64, u64)>;

fn listing(dir: &Path, prefix: &str, found: &mut Found) -> Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();

        if name.starts_with(STAGING) {
            let _ = std::fs::remove_file(entry.path());

            continue;
        }

        if ignored(&name) {
            continue;
        }

        let meta = std::fs::symlink_metadata(entry.path())?;
        let relative = if prefix.is_empty() {
            name
        } else {
            format!("{prefix}/{name}")
        };

        if meta.is_dir() {
            listing(&entry.path(), &relative, found)?;
        } else if meta.is_file() {
            found.push((relative, entry.path(), meta.len(), millis(&meta)));
        }
    }

    Ok(())
}

fn located(folder: &Path, name: &str) -> Result<PathBuf> {
    wire::safe_relative(name)
        .map(|relative| folder.join(relative))
        .ok_or(Error::Invalid)
}

fn free_path(folder: &Path, name: &str) -> Result<PathBuf> {
    let wanted = located(folder, name)?;

    if !wanted.exists() {
        return Ok(wanted);
    }

    let parent = wanted.parent().ok_or(Error::Invalid)?;
    let file = wanted
        .file_name()
        .map(|file| file.to_string_lossy().into_owned())
        .ok_or(Error::Invalid)?;

    Ok(wire::vacant(parent, &file))
}

fn unchanged(target: &Path, expected: Option<&Entry>) -> bool {
    let current = std::fs::symlink_metadata(target)
        .ok()
        .map(|meta| (meta.is_file(), meta.len(), millis(&meta)));

    current == expected.map(|entry| (true, entry.size, entry.modified))
}

#[cfg(windows)]
async fn recycle(path: PathBuf) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::ops::recycle(vec![path.to_string_lossy().into_owned()])
    })
    .await
    .map_err(fail)?
}

// phones have no recycle bin to send a synced deletion to
#[cfg(not(windows))]
async fn recycle(path: PathBuf) -> Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        if path.is_dir() {
            std::fs::remove_dir_all(&path)
        } else {
            std::fs::remove_file(&path)
        }
    })
    .await
    .map_err(fail)?
    .map_err(Into::into)
}

#[cfg(windows)]
use crate::watch::watch_tree;

// without a change journal the folder is rescanned on a timer
#[cfg(not(windows))]
fn watch_tree(
    _path: PathBuf,
    settle: std::time::Duration,
    on_change: impl Fn() + Send + 'static,
) -> std::sync::Arc<std::sync::atomic::AtomicBool> {
    let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let stopped = stop.clone();
    let every = settle.max(std::time::Duration::from_secs(30));

    std::thread::spawn(move || {
        while !stopped.load(Ordering::Relaxed) {
            std::thread::sleep(every);

            if !stopped.load(Ordering::Relaxed) {
                on_change();
            }
        }
    });

    stop
}

impl Node {
    fn ledger_file(&self, id: Uuid) -> PathBuf {
        self.dir.join("sync").join(format!("{id}.json"))
    }

    fn ledger(&self, id: Uuid) -> Option<Ledger> {
        let bytes = std::fs::read(self.ledger_file(id)).ok()?;

        serde_json::from_slice(&bytes).ok()
    }

    fn keep_ledger(&self, id: Uuid, ledger: &Ledger) -> Result<()> {
        let file = self.ledger_file(id);
        let staging = file.with_extension("json.tmp");

        if let Some(folder) = file.parent() {
            std::fs::create_dir_all(folder)?;
        }

        std::fs::write(&staging, serde_json::to_vec(ledger).map_err(fail)?)?;
        std::fs::rename(staging, file)?;

        Ok(())
    }

    fn find_sync(&self, id: Uuid) -> Option<Sync> {
        self.lock().syncs.iter().find(|sync| sync.id == id).cloned()
    }

    fn mark(&self, id: Uuid, change: impl FnOnce(&mut Sync)) {
        let _ = self.update(|saved| {
            if let Some(sync) = saved.syncs.iter_mut().find(|sync| sync.id == id) {
                change(sync);
            }
        });
    }

    async fn scan(self: &Arc<Self>, sync: &Sync, ledger: &mut Ledger) -> Result<bool> {
        let folder = PathBuf::from(&sync.folder);

        let found = tauri::async_runtime::spawn_blocking(move || {
            let mut found = Vec::new();

            listing(&folder, "", &mut found).map(|_| found)
        })
        .await
        .map_err(fail)??;

        let net = self.net().await?;
        let batch = net.store.batch().await.map_err(fail)?;
        let mut index = HashMap::with_capacity(found.len());
        let mut held = Vec::new();

        for (path, file, size, modified) in found {
            let key = path.to_lowercase();
            let known = ledger.index.get(&key);
            let cached = known
                .filter(|known| known.size == size && known.modified == modified)
                .map(|known| known.hash);

            let hash = match cached {
                Some(hash) => Some(hash),
                None => batch
                    .add_path_with_opts(AddPathOptions {
                        path: file,
                        format: BlobFormat::Raw,
                        mode: ImportMode::TryReference,
                    })
                    .await
                    .ok()
                    .map(|tag| {
                        let hash = tag.hash();

                        held.push(tag);

                        hash
                    }),
            };

            let entry = match (hash, known) {
                (Some(hash), _) => Entry {
                    path,
                    hash,
                    size,
                    modified,
                },
                // an unreadable file keeps its last known entry, so the peer never reads it as deleted
                (None, Some(known)) => known.clone(),
                (None, None) => continue,
            };

            index.insert(key, entry);
        }

        let root = Collection::from_iter(
            index
                .values()
                .map(|entry: &Entry| (entry.path.clone(), entry.hash)),
        )
        .store(&net.store)
        .await
        .map_err(fail)?;

        net.store
            .tags()
            .set(format!("sync-{}", sync.id), root.hash_and_format())
            .await
            .map_err(fail)?;

        drop(held);

        self.sync_hashes
            .lock()
            .unwrap()
            .insert(sync.id, index.values().map(|entry| entry.hash).collect());

        let changed = index != ledger.index;
        let files = index.len() as u64;

        ledger.index = index;
        self.keep_ledger(sync.id, ledger)?;

        if self
            .find_sync(sync.id)
            .is_some_and(|known| known.files != files)
        {
            self.mark(sync.id, |sync| sync.files = files);
        }

        Ok(changed)
    }

    async fn fetch_to(
        self: &Arc<Self>,
        peer: EndpointId,
        entry: &Entry,
        target: &Path,
        expected: Option<&Entry>,
    ) -> Result<bool> {
        let net = self.net().await?;

        net.downloader
            .download(HashAndFormat::raw(entry.hash), Shuffled::new(vec![peer]))
            .await
            .map_err(fail)?;

        let folder = target.parent().ok_or(Error::Invalid)?;

        std::fs::create_dir_all(folder)?;

        let staging = folder.join(format!("{STAGING}{}", Uuid::new_v4()));

        let placed: Result<bool> = async {
            net.store
                .blobs()
                .export(entry.hash, &staging)
                .await
                .map_err(fail)?;

            File::options()
                .write(true)
                .open(&staging)?
                .set_modified(UNIX_EPOCH + Duration::from_millis(entry.modified))?;

            if !unchanged(target, expected) {
                return Ok(false);
            }

            std::fs::rename(&staging, target)?;

            Ok(true)
        }
        .await;

        if !matches!(placed, Ok(true)) {
            let _ = std::fs::remove_file(&staging);
        }

        placed
    }

    async fn apply(
        self: &Arc<Self>,
        sync: &Sync,
        key: String,
        action: Action,
        ledger: &mut Ledger,
    ) -> Result<()> {
        let folder = Path::new(&sync.folder);
        let local = ledger.index.get(&key).cloned();

        match action {
            Action::Agree(Some(hash)) => {
                ledger.base.insert(key, hash);
            }
            Action::Agree(None) => {
                ledger.base.remove(&key);
            }
            Action::Wait => {}
            Action::Recycle => {
                let Some(local) = local else {
                    return Ok(());
                };

                let target = located(folder, &local.path)?;

                if unchanged(&target, Some(&local)) {
                    recycle(target).await?;
                    ledger.index.remove(&key);
                    ledger.base.remove(&key);
                }
            }
            Action::Take(entry) => {
                let name = local
                    .as_ref()
                    .map_or_else(|| entry.path.clone(), |local| local.path.clone());
                let target = located(folder, &name)?;

                if self
                    .fetch_to(sync.device, &entry, &target, local.as_ref())
                    .await?
                {
                    ledger.base.insert(key.clone(), entry.hash);
                    ledger.index.insert(
                        key,
                        Entry {
                            path: name,
                            ..entry
                        },
                    );
                }
            }
            Action::Restore(entry) => {
                let target = located(folder, &entry.path)?;

                if self.fetch_to(sync.device, &entry, &target, None).await? {
                    ledger.index.insert(key, entry);
                }
            }
            Action::CopyTheirs(entry) => {
                let copy = conflict_name(&entry.path, &sync.device);
                let present = ledger
                    .index
                    .get(&copy.to_lowercase())
                    .is_some_and(|known| known.hash == entry.hash);

                if !present {
                    let destination = free_path(folder, &copy)?;

                    self.fetch_to(sync.device, &entry, &destination, None)
                        .await?;
                }
            }
            Action::ParkMine(entry) => {
                let Some(local) = local else {
                    return Ok(());
                };

                let target = located(folder, &local.path)?;

                if !unchanged(&target, Some(&local)) {
                    return Ok(());
                }

                let parked = free_path(folder, &conflict_name(&local.path, &self.id))?;

                std::fs::rename(&target, &parked)?;
                ledger.index.remove(&key);

                if self.fetch_to(sync.device, &entry, &target, None).await? {
                    ledger.index.insert(
                        key,
                        Entry {
                            path: local.path,
                            ..entry
                        },
                    );
                }
            }
        }

        Ok(())
    }

    async fn reconcile(self: &Arc<Self>, sync: &Sync, ledger: &mut Ledger) -> Result<()> {
        let entries = match self
            .call(sync.device, Request::SyncIndex { sync: sync.id })
            .await?
        {
            Reply::Index { entries } => entries,
            _ => return Err(Error::Pending),
        };

        if !sync.linked {
            self.mark(sync.id, |sync| sync.linked = true);
        }

        let remote: HashMap<String, Entry> = entries
            .into_iter()
            .filter(|entry| wire::safe_relative(&entry.path).is_some())
            .map(|entry| (entry.path.to_lowercase(), entry))
            .collect();

        let keys: BTreeSet<String> = ledger
            .index
            .keys()
            .chain(remote.keys())
            .chain(ledger.base.keys())
            .cloned()
            .collect();

        let (removals, writes): (Vec<_>, Vec<_>) = keys
            .into_iter()
            .map(|key| {
                let action = decide(
                    ledger.index.get(&key),
                    remote.get(&key),
                    ledger.base.get(&key),
                    &self.id,
                    &sync.device,
                );

                (key, action)
            })
            .partition(|(_, action)| matches!(action, Action::Recycle));

        let mut first = None;

        for (key, action) in removals.into_iter().chain(writes) {
            if let Err(error) = self.apply(sync, key, action, ledger).await {
                first.get_or_insert(error);
            }
        }

        first.map_or(Ok(()), Err)
    }

    async fn round(self: &Arc<Self>, sync: &Sync) -> Result<bool> {
        let mut ledger = self.ledger(sync.id).unwrap_or_default();
        let edited = self.scan(sync, &mut ledger).await?;
        let reconciled = self.reconcile(sync, &mut ledger).await;

        self.keep_ledger(sync.id, &ledger)?;

        let settled = self.scan(sync, &mut ledger).await?;

        reconciled.map(|_| edited || settled)
    }

    async fn run_sync(self: &Arc<Self>, id: Uuid, first: bool) {
        let Some(sync) = self.find_sync(id).filter(|sync| !sync.paused) else {
            return;
        };

        if !self.knows(&sync.device) {
            self.mark(id, |sync| sync.error = Some(Error::Unpaired.to_string()));

            return;
        }

        match self.round(&sync).await {
            Ok(changed) => {
                self.mark(id, |sync| {
                    sync.synced_at = Some(now());
                    sync.error = None;
                });

                if first || changed {
                    let _ = self
                        .call(sync.device, Request::SyncChanged { sync: id })
                        .await;
                }
            }
            Err(error) => self.mark(id, |sync| sync.error = Some(error.to_string())),
        }
    }

    fn start_sync(self: &Arc<Self>, id: Uuid) {
        let Some(sync) = self.find_sync(id).filter(|sync| !sync.paused) else {
            return;
        };

        let mut slots = self.slots.lock().unwrap();

        if slots.contains_key(&id) {
            return;
        }

        let wake = Arc::new(Notify::new());

        let watcher = {
            let wake = wake.clone();

            watch_tree(PathBuf::from(&sync.folder), SETTLE, move || {
                wake.notify_one()
            })
        };

        let node = self.clone();
        let signal = wake.clone();

        let task = tauri::async_runtime::spawn(async move {
            node.run_sync(id, true).await;

            loop {
                signal.notified().await;
                node.run_sync(id, false).await;
            }
        });

        slots.insert(
            id,
            Slot {
                wake,
                watcher,
                task,
            },
        );
    }

    async fn stop_sync(&self, id: Uuid) {
        let slot = self.slots.lock().unwrap().remove(&id);

        if let Some(slot) = slot {
            slot.watcher.store(true, Ordering::Relaxed);
            slot.task.abort();

            let _ = slot.task.await;
        }

        self.sync_hashes.lock().unwrap().remove(&id);
    }

    pub(super) fn nudge(&self, id: Uuid) {
        if let Some(slot) = self.slots.lock().unwrap().get(&id) {
            slot.wake.notify_one();
        }
    }

    pub(super) fn resume_syncs(self: &Arc<Self>) {
        let active: Vec<Uuid> = self
            .lock()
            .syncs
            .iter()
            .filter(|sync| !sync.paused)
            .map(|sync| sync.id)
            .collect();

        for id in active {
            self.start_sync(id);
        }
    }

    pub(super) async fn create_sync(
        self: &Arc<Self>,
        folder: PathBuf,
        device: EndpointId,
    ) -> Result<()> {
        if !self.knows(&device) {
            return Err(Error::Unpaired);
        }

        let id = Uuid::new_v4();
        let name = folder
            .file_name()
            .unwrap_or(folder.as_os_str())
            .to_string_lossy()
            .into_owned();

        match self
            .call(device, Request::SyncInvite { sync: id, name })
            .await?
        {
            Reply::Accepted => {}
            _ => return Err(Error::Denied),
        }

        self.update(|saved| {
            saved.syncs.insert(
                0,
                Sync {
                    id,
                    folder: folder.to_string_lossy().into_owned(),
                    device,
                    paused: false,
                    linked: false,
                    created_at: now(),
                    synced_at: None,
                    files: 0,
                    error: None,
                },
            )
        })?;

        self.start_sync(id);

        Ok(())
    }

    pub(super) fn accept_sync(self: &Arc<Self>, id: Uuid, folder: PathBuf) -> Result<()> {
        let invite = self
            .lock()
            .sync_invites
            .iter()
            .find(|invite| invite.id == id)
            .cloned()
            .ok_or(Error::Missing)?;

        if !self.knows(&invite.from) {
            return Err(Error::Unpaired);
        }

        self.update(|saved| {
            saved.sync_invites.retain(|known| known.id != id);
            saved.syncs.insert(
                0,
                Sync {
                    id,
                    folder: folder.to_string_lossy().into_owned(),
                    device: invite.from,
                    paused: false,
                    linked: true,
                    created_at: now(),
                    synced_at: None,
                    files: 0,
                    error: None,
                },
            );
        })?;

        self.start_sync(id);

        Ok(())
    }

    pub(super) fn decline_sync(&self, id: Uuid) -> Result<()> {
        self.update(|saved| saved.sync_invites.retain(|invite| invite.id != id))
    }

    pub(super) async fn pause_sync(self: &Arc<Self>, id: Uuid, paused: bool) -> Result<()> {
        self.update(|saved| {
            if let Some(sync) = saved.syncs.iter_mut().find(|sync| sync.id == id) {
                sync.paused = paused;
            }
        })?;

        if paused {
            self.stop_sync(id).await;
        } else {
            self.start_sync(id);
        }

        Ok(())
    }

    pub(super) async fn drop_sync(self: &Arc<Self>, id: Uuid) -> Result<()> {
        self.stop_sync(id).await;
        self.update(|saved| saved.syncs.retain(|sync| sync.id != id))?;

        match std::fs::remove_file(self.ledger_file(id)) {
            Err(error) if error.kind() != ErrorKind::NotFound => return Err(error.into()),
            _ => {}
        }

        self.net()
            .await?
            .store
            .tags()
            .delete(format!("sync-{id}"))
            .await
            .map_err(fail)?;

        Ok(())
    }

    pub(super) fn invited(&self, remote: EndpointId, id: Uuid, name: String) -> Reply {
        let taken = {
            let saved = self.lock();

            saved.syncs.iter().any(|sync| sync.id == id)
                || saved
                    .sync_invites
                    .iter()
                    .any(|invite| invite.id == id && invite.from != remote)
        };

        if taken {
            return Reply::Denied;
        }

        self.attention.store(true, Ordering::Relaxed);

        let stored = self.update(|saved| {
            saved.sync_invites.retain(|invite| invite.id != id);
            saved.sync_invites.insert(
                0,
                SyncInvite {
                    id,
                    from: remote,
                    name,
                    received_at: now(),
                },
            );
        });

        match stored {
            Ok(()) => Reply::Accepted,
            Err(_) => Reply::Denied,
        }
    }

    fn active_with(&self, remote: &EndpointId, id: Uuid) -> bool {
        self.find_sync(id)
            .is_some_and(|sync| !sync.paused && sync.device == *remote)
    }

    pub(super) fn index_reply(&self, remote: &EndpointId, id: Uuid) -> Reply {
        if !self.active_with(remote, id) {
            return Reply::Denied;
        }

        match self.ledger(id) {
            Some(ledger) => Reply::Index {
                entries: ledger.index.into_values().collect(),
            },
            None => Reply::Denied,
        }
    }

    pub(super) fn wake_sync(&self, remote: &EndpointId, id: Uuid) -> Reply {
        if !self.active_with(remote, id) {
            return Reply::Denied;
        }

        self.nudge(id);

        Reply::Accepted
    }
}
