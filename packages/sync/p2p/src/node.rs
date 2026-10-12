//! Node membership, authenticated exchange, and lazy endpoint transport.

use std::fmt;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::time::Duration;

use iroh::endpoint::{presets, Connection};
use iroh::protocol::{AcceptError, ProtocolHandler, Router};
use iroh::{Endpoint, EndpointAddr, EndpointId, SecretKey};
use tokio::sync::OnceCell;
use tokio::time::timeout;

use super::protocol::{
    encode, fail, read, same, write, Exchange, Hello, Peer, Rotation, Status, ALPN, MAX_FRAME,
    MAX_HELLO,
};
use super::state::{self, now, random, Saved};

const DIAL_TIMEOUT: Duration = Duration::from_secs(8);
const SERVE_TIMEOUT: Duration = Duration::from_secs(30);
const ONLINE_TIMEOUT: Duration = Duration::from_secs(10);

pub enum Event {
    Snapshot(String),
    Peers,
}

pub(crate) type Sink = Box<dyn Fn(Event) + Send + Sync>;

pub(super) static FILES: OnceLock<String> = OnceLock::new();

pub struct Node {
    id: EndpointId,
    file: PathBuf,
    saved: Mutex<Saved>,
    snapshot: Mutex<Option<String>>,
    sink: Sink,
    router: OnceCell<Router>,
}

struct Listener(Arc<Node>);

impl fmt::Debug for Listener {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Listener")
    }
}

impl ProtocolHandler for Listener {
    async fn accept(&self, connection: Connection) -> Result<(), AcceptError> {
        match timeout(SERVE_TIMEOUT, self.0.serve(&connection)).await {
            Ok(Ok(())) => {
                // returning drops the connection, which can discard our unacked final frame
                let _ = timeout(SERVE_TIMEOUT, connection.closed()).await;
            }
            _ => connection.close(1u32.into(), b"rejected"),
        }

        Ok(())
    }
}

fn status_of(saved: &Saved) -> Status {
    let since = saved.joined_at.unwrap_or(0);

    Status {
        node_id: SecretKey::from_bytes(&saved.key).public().to_string(),
        paired: saved.chain.is_some(),
        peers: saved.peers.clone(),
        removable: saved
            .peers
            .iter()
            .filter(|peer| saved.may_remove(since, &peer.node_id))
            .map(|peer| peer.node_id.clone())
            .collect(),
    }
}

pub fn stored_status(dir: &Path) -> Result<Option<Status>, String> {
    Ok(state::load(&dir.join("p2p.json"))?.as_ref().map(status_of))
}

impl Node {
    pub fn open(dir: &Path, sink: Sink) -> Result<Self, String> {
        let file = dir.join("p2p.json");

        let stored = state::load(&file)?;
        let fresh = stored.is_none();
        let saved = stored.unwrap_or_else(Saved::fresh);

        let node = Self {
            id: SecretKey::from_bytes(&saved.key).public(),
            file,
            saved: Mutex::new(saved),
            snapshot: Mutex::new(None),
            sink,
            router: OnceCell::new(),
        };

        if fresh {
            node.persist(&node.lock());
        }

        Ok(node)
    }

    pub(super) fn lock(&self) -> MutexGuard<'_, Saved> {
        self.saved.lock().unwrap()
    }

    fn persist(&self, saved: &Saved) {
        state::persist(&self.file, saved);
    }

    pub fn status(&self) -> Status {
        status_of(&self.lock())
    }

    pub fn publish(&self, snapshot: String) {
        *self.snapshot.lock().unwrap() = Some(snapshot);
    }

    pub(super) async fn endpoint(self: &Arc<Self>) -> Result<Endpoint, String> {
        let router = self
            .router
            .get_or_try_init(|| async {
                let key = SecretKey::from_bytes(&self.lock().key);

                let endpoint = Endpoint::builder(presets::N0)
                    .secret_key(key)
                    .bind()
                    .await
                    .map_err(fail)?;

                Ok::<_, String>(
                    Router::builder(endpoint)
                        .accept(ALPN, Listener(self.clone()))
                        .spawn(),
                )
            })
            .await?;

        Ok(router.endpoint().clone())
    }

    pub async fn invite(self: &Arc<Self>, name: String) -> Result<String, String> {
        let chain = {
            let mut saved = self.lock();

            saved.name = name;

            if saved.chain.is_none() {
                saved.joined_at = Some(now());
            }

            let chain = *saved.chain.get_or_insert_with(random);

            self.persist(&saved);

            chain
        };

        let endpoint = self.endpoint().await?;

        let _ = timeout(ONLINE_TIMEOUT, endpoint.online()).await;

        Ok(self.code_for(&chain))
    }

    fn code_for(&self, chain: &[u8; 32]) -> String {
        format!("{}.{}", encode(self.id.as_bytes()), encode(chain))
    }

    pub fn code(&self) -> Option<String> {
        self.lock().chain.map(|chain| self.code_for(&chain))
    }

    pub async fn sync(self: &Arc<Self>) -> Result<usize, String> {
        let ids: Vec<EndpointId> = {
            let saved = self.lock();

            if saved.chain.is_none() {
                return Ok(0);
            }

            saved
                .peers
                .iter()
                .filter_map(|peer| peer.node_id.parse().ok())
                .collect()
        };

        let endpoint = self.endpoint().await?;

        let dials: Vec<_> = ids
            .into_iter()
            .map(|id| {
                let node = self.clone();
                let endpoint = endpoint.clone();

                tokio::spawn(
                    async move { timeout(DIAL_TIMEOUT, node.dial(&endpoint, id.into())).await },
                )
            })
            .collect();

        let mut reached = 0;

        for dial in dials {
            if matches!(dial.await, Ok(Ok(Ok(())))) {
                reached += 1;
            }
        }

        Ok(reached)
    }

    async fn dial(&self, endpoint: &Endpoint, addr: EndpointAddr) -> Result<(), String> {
        let hello = {
            let saved = self.lock();

            Hello {
                secret: saved.chain.ok_or("not paired")?,
                retired: saved.retired.clone(),
            }
        };

        let remote = addr.id;

        let connection = endpoint.connect(addr, ALPN).await.map_err(fail)?;
        let (mut send, mut recv) = connection.open_bi().await.map_err(fail)?;

        write(&mut send, &hello).await?;
        write(&mut send, &self.outgoing()).await?;
        send.finish().map_err(fail)?;

        let exchange: Exchange = read(&mut recv, MAX_FRAME).await?;

        connection.close(0u32.into(), b"done");
        self.absorb(remote, exchange);

        Ok(())
    }

    async fn serve(&self, connection: &Connection) -> Result<(), String> {
        let remote = connection.remote_id();
        let (mut send, mut recv) = connection.accept_bi().await.map_err(fail)?;

        let hello: Hello = read(&mut recv, MAX_HELLO).await?;

        if !self.admits(&hello, &remote) {
            return Err("rejected".into());
        }

        let exchange: Exchange = read(&mut recv, MAX_FRAME).await?;

        write(&mut send, &self.outgoing()).await?;
        send.finish().map_err(fail)?;

        self.absorb(remote, exchange);

        Ok(())
    }

    // a known peer still holding a retired chain gets in so it can learn the current one
    fn admits(&self, hello: &Hello, remote: &EndpointId) -> bool {
        let saved = self.lock();
        let remote = remote.to_string();

        let Some(chain) = saved.chain else {
            return false;
        };

        if saved.revokes(&remote) {
            return false;
        }

        if same(&chain, &hello.secret) {
            return true;
        }

        saved.knows(&remote)
            && (hello.retired.iter().any(|old| same(old, &chain))
                || saved.retired.iter().any(|old| same(old, &hello.secret)))
    }

    fn outgoing(&self) -> Exchange {
        let saved = self.lock();

        let mut peers = saved.peers.clone();

        peers.push(Peer {
            node_id: self.id.to_string(),
            name: saved.name.clone(),
            last_seen: None,
            first_seen: None,
            files: FILES.get().cloned(),
        });

        Exchange {
            peers,
            snapshot: self.snapshot.lock().unwrap().clone(),
            revoked: saved.revoked.clone(),
            rotation: saved.chain.map(|chain| Rotation {
                epoch: saved.epoch,
                chain,
            }),
        }
    }

    fn absorb(&self, remote: EndpointId, exchange: Exchange) {
        {
            let mut saved = self.lock();

            if !saved.honor(&self.id.to_string(), exchange.revoked) {
                self.persist(&saved);
                drop(saved);
                (self.sink)(Event::Peers);

                return;
            }

            if let Some(rotation) = exchange.rotation {
                saved.adopt(rotation);
            }

            for peer in exchange.peers {
                let Ok(id) = peer.node_id.parse::<EndpointId>() else {
                    continue;
                };

                if id == self.id {
                    continue;
                }

                let node_id = id.to_string();

                if saved.revokes(&node_id) {
                    continue;
                }

                let index = match saved
                    .peers
                    .iter()
                    .position(|known| known.node_id == node_id)
                {
                    Some(index) => index,
                    None => {
                        saved.peers.push(Peer {
                            node_id,
                            name: peer.name.clone(),
                            last_seen: None,
                            first_seen: Some(now()),
                            files: None,
                        });

                        saved.peers.len() - 1
                    }
                };

                // only a peer itself can say which Files node is its own
                if id == remote {
                    saved.peers[index].name = peer.name;
                    saved.peers[index].last_seen = Some(now());
                    saved.peers[index].files = peer.files;
                }
            }

            self.persist(&saved);
        }

        (self.sink)(Event::Peers);

        if let Some(snapshot) = exchange.snapshot.filter(|snapshot| !snapshot.is_empty()) {
            (self.sink)(Event::Snapshot(snapshot));
        }
    }
}

#[cfg(feature = "tauri")]
impl Node {
    const JOIN_TIMEOUT: Duration = Duration::from_secs(20);

    pub(crate) fn paired(&self) -> bool {
        self.lock().chain.is_some()
    }

    pub(crate) fn leave(&self) {
        {
            let mut saved = self.lock();

            saved.forget();
            self.persist(&saved);
        }

        (self.sink)(Event::Peers);
    }

    pub(crate) fn remove(&self, node_id: String) -> Result<(), String> {
        {
            let mut saved = self.lock();
            let since = saved.joined_at.unwrap_or(0);

            if saved.chain.is_none() || !saved.knows(&node_id) || !saved.may_remove(since, &node_id)
            {
                return Err("not allowed".into());
            }

            saved.peers.retain(|peer| peer.node_id != node_id);
            saved.revoked.push(super::protocol::Revocation {
                node_id,
                by: self.id.to_string(),
            });
            saved.rotate();
            self.persist(&saved);
        }

        (self.sink)(Event::Peers);

        Ok(())
    }

    pub(crate) async fn join(
        self: &Arc<Self>,
        inviter: EndpointAddr,
        chain: [u8; 32],
        name: String,
    ) -> Result<(), String> {
        let endpoint = self.endpoint().await?;

        let previous = {
            let mut saved = self.lock();

            saved.name = name;

            (
                saved.chain.replace(chain),
                std::mem::take(&mut saved.peers),
                saved.joined_at.replace(now()),
                std::mem::take(&mut saved.epoch),
                std::mem::take(&mut saved.retired),
                std::mem::take(&mut saved.revoked),
            )
        };

        let outcome = timeout(Self::JOIN_TIMEOUT, self.dial(&endpoint, inviter))
            .await
            .unwrap_or_else(|_| Err("inviter unreachable".into()));

        let mut saved = self.lock();

        if outcome.is_err() {
            (
                saved.chain,
                saved.peers,
                saved.joined_at,
                saved.epoch,
                saved.retired,
                saved.revoked,
            ) = previous;
        }

        self.persist(&saved);

        outcome
    }
}
