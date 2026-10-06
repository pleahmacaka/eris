use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};

use iroh::{EndpointId, SecretKey};
use serde::{Deserialize, Serialize};
use tokio::time::timeout;
use uuid::Uuid;

use super::net::DIAL_TIMEOUT;
use super::outgoing::Outgoing;
use super::wire::{self, Reply, Request};
use super::{now, Node};
use crate::error::{Error, Result};

const INVITE_TTL: Duration = Duration::from_secs(600);
pub(super) const SENIORITY: u64 = 24 * 60 * 60 * 1000;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Device {
    pub(super) id: EndpointId,
    pub(super) name: String,
    pub(super) added_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Invite {
    code: String,
    link: String,
}

pub(super) fn default_name() -> String {
    std::env::var("COMPUTERNAME")
        .ok()
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "Eris Files".into())
}

fn same(a: &[u8; 32], b: &[u8; 32]) -> bool {
    a.iter().zip(b).fold(0, |diff, (x, y)| diff | (x ^ y)) == 0
}

impl Node {
    pub(super) fn knows(&self, peer: &EndpointId) -> bool {
        self.lock().knows(peer)
    }

    pub(super) async fn invite(self: &Arc<Self>) -> Result<Invite> {
        let secret = SecretKey::generate().to_bytes();

        *self.invite.lock().unwrap() = Some((secret, Instant::now()));

        let net = self.net().await?;

        let _ = timeout(DIAL_TIMEOUT, net.router.endpoint().online()).await;

        let code = format!(
            "{}.{}",
            wire::encode(self.id.as_bytes()),
            wire::encode(&secret)
        );

        Ok(Invite {
            link: wire::pair_link(&code),
            code,
        })
    }

    pub(super) async fn join(self: &Arc<Self>, code: &str) -> Result<()> {
        let (inviter, secret) = wire::parse_code(code)?;

        if inviter == self.id {
            return Err(Error::SelfPair);
        }

        let name = self.lock().name.clone();

        match self.call(inviter, Request::Pair { secret, name }).await? {
            Reply::Welcome { name } => {
                *self.pending_pair.lock().unwrap() = None;
                self.remember(inviter, name)
            }
            _ => Err(Error::Denied),
        }
    }

    pub(super) fn pair(&self, remote: EndpointId, secret: [u8; 32], name: String) -> Reply {
        let accepted = self
            .invite
            .lock()
            .unwrap()
            .take_if(|(code, at)| same(code, &secret) && at.elapsed() < INVITE_TTL)
            .is_some();

        if !accepted || self.remember(remote, name).is_err() {
            return Reply::Denied;
        }

        Reply::Welcome {
            name: self.lock().name.clone(),
        }
    }

    fn remember(&self, id: EndpointId, name: String) -> Result<()> {
        self.update(
            |saved| match saved.devices.iter_mut().find(|known| known.id == id) {
                Some(known) => known.name = name,
                None => saved.devices.push(Device {
                    id,
                    name,
                    added_at: now(),
                }),
            },
        )
    }

    pub(super) fn prompt_pair(&self, code: String) {
        *self.pending_pair.lock().unwrap() = Some(code);
        self.attention.store(true, Ordering::Relaxed);
        self.changed();
    }

    // ponytail: devices offline right now never hear of the removal; queue it if that matters
    pub(super) async fn remove_device(self: &Arc<Self>, id: EndpointId) -> Result<()> {
        let witnesses: Vec<EndpointId> = {
            let saved = self.lock();

            if saved.senior() {
                saved
                    .devices
                    .iter()
                    .map(|device| device.id)
                    .filter(|device| *device != id)
                    .collect()
            } else {
                Vec::new()
            }
        };

        self.forget_device(id).await?;

        let device = wire::encode(id.as_bytes());

        for witness in witnesses {
            let node = self.clone();
            let device = device.clone();

            tauri::async_runtime::spawn(async move {
                let _ = node.call(witness, Request::Evict { device }).await;
            });
        }

        Ok(())
    }

    pub(super) fn evicted(self: &Arc<Self>, remote: EndpointId, device: &str) -> Reply {
        let Some(target) = wire::decode_id(device) else {
            return Reply::Denied;
        };

        let allowed = {
            let saved = self.lock();

            match (saved.added_at(&remote), saved.added_at(&target)) {
                (Some(by), Some(at)) => now().saturating_sub(by) >= SENIORITY && at >= by,
                _ => false,
            }
        };

        if !allowed {
            return Reply::Denied;
        }

        let node = self.clone();

        tauri::async_runtime::spawn(async move {
            let _ = node.forget_device(target).await;
        });

        Reply::Accepted
    }

    async fn forget_device(self: &Arc<Self>, id: EndpointId) -> Result<()> {
        let (orphaned, received) = self.update(|saved| {
            let received: Vec<Uuid> = saved
                .inbox
                .iter()
                .filter(|entry| entry.from == id)
                .map(|entry| entry.id)
                .collect();

            saved.devices.retain(|device| device.id != id);
            saved.sync_invites.retain(|invite| invite.from != id);
            saved.inbox.retain(|entry| entry.from != id);

            for share in &mut saved.shares {
                share.devices.retain(|device| *device != id);
            }

            let (orphaned, kept): (Vec<Outgoing>, Vec<Outgoing>) =
                std::mem::take(&mut saved.shares)
                    .into_iter()
                    .partition(Outgoing::orphaned);

            saved.shares = kept;

            (orphaned, received)
        })?;

        for share in &orphaned {
            self.forget(share);
        }

        for entry in received {
            self.cancel(entry);
        }

        let syncs: Vec<Uuid> = self
            .lock()
            .syncs
            .iter()
            .filter(|sync| sync.device == id)
            .map(|sync| sync.id)
            .collect();

        for sync in syncs {
            self.drop_sync(sync).await?;
        }

        Ok(())
    }
}
