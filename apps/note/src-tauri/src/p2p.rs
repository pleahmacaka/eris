use std::fmt;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use data_encoding::BASE32_NOPAD_NOCASE;
use iroh::endpoint::{presets, Connection, RecvStream, SendStream};
use iroh::protocol::{AcceptError, ProtocolHandler, Router};
use iroh::{Endpoint, EndpointAddr, EndpointId, SecretKey};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::OnceCell;
use tokio::time::timeout;

const ALPN: &[u8] = b"eris/sync/1";
const MAX_FRAME: usize = 32 * 1024 * 1024;
const MAX_HELLO: usize = 1024;
const DIAL_TIMEOUT: Duration = Duration::from_secs(8);
const JOIN_TIMEOUT: Duration = Duration::from_secs(20);
const SERVE_TIMEOUT: Duration = Duration::from_secs(30);
const ONLINE_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Peer {
    node_id: String,
    name: String,
    #[serde(default)]
    last_seen: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    node_id: String,
    paired: bool,
    peers: Vec<Peer>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Saved {
    key: [u8; 32],
    chain: Option<[u8; 32]>,
    name: String,
    peers: Vec<Peer>,
}

#[derive(Serialize, Deserialize)]
struct Hello {
    secret: [u8; 32],
}

#[derive(Serialize, Deserialize)]
struct Exchange {
    peers: Vec<Peer>,
    snapshot: Option<String>,
}

pub enum Event {
    Snapshot(String),
    Peers,
}

type Sink = Box<dyn Fn(Event) + Send + Sync>;

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

impl Node {
    fn open(dir: &Path, sink: Sink) -> Self {
        let file = dir.join("p2p.json");

        let stored = std::fs::read(&file)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Saved>(&bytes).ok());

        let fresh = stored.is_none();

        let saved = stored.unwrap_or_else(|| Saved {
            key: random(),
            chain: None,
            name: String::new(),
            peers: Vec::new(),
        });

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

        node
    }

    fn lock(&self) -> MutexGuard<'_, Saved> {
        self.saved.lock().unwrap()
    }

    fn persist(&self, saved: &Saved) {
        let Ok(bytes) = serde_json::to_vec(saved) else {
            return;
        };

        let staging = self.file.with_extension("json.tmp");

        let _ = self.file.parent().map(std::fs::create_dir_all);

        if std::fs::write(&staging, bytes).is_ok() {
            let _ = std::fs::rename(staging, &self.file);
        }
    }

    fn status(&self) -> Status {
        let saved = self.lock();

        Status {
            node_id: self.id.to_string(),
            paired: saved.chain.is_some(),
            peers: saved.peers.clone(),
        }
    }

    fn paired(&self) -> bool {
        self.lock().chain.is_some()
    }

    fn publish(&self, snapshot: String) {
        *self.snapshot.lock().unwrap() = Some(snapshot);
    }

    fn leave(&self) {
        {
            let mut saved = self.lock();

            saved.chain = None;
            saved.peers.clear();
            self.persist(&saved);
        }

        (self.sink)(Event::Peers);
    }

    async fn endpoint(self: &Arc<Self>) -> Result<Endpoint, String> {
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

    async fn invite(self: &Arc<Self>, name: String) -> Result<String, String> {
        let chain = {
            let mut saved = self.lock();

            saved.name = name;

            let chain = *saved.chain.get_or_insert_with(random);

            self.persist(&saved);

            chain
        };

        let endpoint = self.endpoint().await?;

        let _ = timeout(ONLINE_TIMEOUT, endpoint.online()).await;

        Ok(format!("{}.{}", encode(self.id.as_bytes()), encode(&chain)))
    }

    async fn join(
        self: &Arc<Self>,
        inviter: EndpointAddr,
        chain: [u8; 32],
        name: String,
    ) -> Result<(), String> {
        let endpoint = self.endpoint().await?;

        let previous = {
            let mut saved = self.lock();

            saved.name = name;

            (saved.chain.replace(chain), std::mem::take(&mut saved.peers))
        };

        let outcome = timeout(JOIN_TIMEOUT, self.dial(&endpoint, inviter))
            .await
            .unwrap_or_else(|_| Err("inviter unreachable".into()));

        if outcome.is_err() {
            let mut saved = self.lock();

            (saved.chain, saved.peers) = previous;
            self.persist(&saved);
        }

        outcome
    }

    async fn sync(self: &Arc<Self>) -> Result<usize, String> {
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

                tauri::async_runtime::spawn(async move {
                    timeout(DIAL_TIMEOUT, node.dial(&endpoint, id.into())).await
                })
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
        let secret = self.lock().chain.ok_or("not paired")?;
        let remote = addr.id;

        let connection = endpoint.connect(addr, ALPN).await.map_err(fail)?;
        let (mut send, mut recv) = connection.open_bi().await.map_err(fail)?;

        write(&mut send, &Hello { secret }).await?;
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

        if !self.admits(&hello.secret) {
            return Err("rejected".into());
        }

        let exchange: Exchange = read(&mut recv, MAX_FRAME).await?;

        write(&mut send, &self.outgoing()).await?;
        send.finish().map_err(fail)?;

        self.absorb(remote, exchange);

        Ok(())
    }

    fn admits(&self, secret: &[u8; 32]) -> bool {
        self.lock().chain.is_some_and(|chain| {
            chain
                .iter()
                .zip(secret)
                .fold(0, |diff, (a, b)| diff | (a ^ b))
                == 0
        })
    }

    fn outgoing(&self) -> Exchange {
        let saved = self.lock();

        let mut peers = saved.peers.clone();

        peers.push(Peer {
            node_id: self.id.to_string(),
            name: saved.name.clone(),
            last_seen: None,
        });

        Exchange {
            peers,
            snapshot: self.snapshot.lock().unwrap().clone(),
        }
    }

    fn absorb(&self, remote: EndpointId, exchange: Exchange) {
        {
            let mut saved = self.lock();

            for peer in exchange.peers {
                let Ok(id) = peer.node_id.parse::<EndpointId>() else {
                    continue;
                };

                if id == self.id {
                    continue;
                }

                let node_id = id.to_string();

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
                        });

                        saved.peers.len() - 1
                    }
                };

                if id == remote {
                    saved.peers[index].name = peer.name;
                    saved.peers[index].last_seen = Some(now());
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

fn random() -> [u8; 32] {
    SecretKey::generate().to_bytes()
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|since| since.as_millis() as u64)
        .unwrap_or_default()
}

fn fail(error: impl fmt::Display) -> String {
    error.to_string()
}

fn encode(bytes: &[u8; 32]) -> String {
    BASE32_NOPAD_NOCASE.encode(bytes).to_ascii_lowercase()
}

fn decode(text: &str) -> Option<[u8; 32]> {
    BASE32_NOPAD_NOCASE
        .decode(text.as_bytes())
        .ok()?
        .try_into()
        .ok()
}

fn parse_code(code: &str) -> Result<(EndpointId, [u8; 32]), String> {
    let invalid = || "invalid pairing code".to_string();

    let (id, chain) = code.trim().split_once('.').ok_or_else(invalid)?;

    let id = decode(id)
        .and_then(|bytes| EndpointId::from_bytes(&bytes).ok())
        .ok_or_else(invalid)?;

    Ok((id, decode(chain).ok_or_else(invalid)?))
}

async fn write<T: Serialize>(send: &mut SendStream, frame: &T) -> Result<(), String> {
    let bytes = serde_json::to_vec(frame).map_err(fail)?;

    if bytes.len() > MAX_FRAME {
        return Err("frame too large".into());
    }

    send.write_all(&(bytes.len() as u32).to_be_bytes())
        .await
        .map_err(fail)?;

    send.write_all(&bytes).await.map_err(fail)
}

async fn read<T: DeserializeOwned>(recv: &mut RecvStream, limit: usize) -> Result<T, String> {
    let mut header = [0; 4];

    recv.read_exact(&mut header).await.map_err(fail)?;

    let length = u32::from_be_bytes(header) as usize;

    if length > limit {
        return Err("frame too large".into());
    }

    let mut bytes = vec![0; length];

    recv.read_exact(&mut bytes).await.map_err(fail)?;

    serde_json::from_slice(&bytes).map_err(fail)
}

static NODE: OnceLock<Arc<Node>> = OnceLock::new();

fn node(app: &AppHandle) -> Result<&'static Arc<Node>, String> {
    if let Some(node) = NODE.get() {
        return Ok(node);
    }

    let dir = app.path().app_data_dir().map_err(fail)?;
    let app = app.clone();

    let sink: Sink = Box::new(move |event| {
        let _ = match event {
            Event::Snapshot(snapshot) => app.emit("p2p-snapshot", snapshot),
            Event::Peers => app.emit("p2p-peers", ()),
        };
    });

    Ok(NODE.get_or_init(|| Arc::new(Node::open(&dir, sink))))
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

#[tauri::command(async)]
pub fn p2p_status(app: AppHandle) -> Result<Status, String> {
    Ok(node(&app)?.status())
}

#[tauri::command(async)]
pub async fn p2p_invite(app: AppHandle, name: String) -> Result<String, String> {
    node(&app)?.invite(name).await
}

#[tauri::command(async)]
pub async fn p2p_join(app: AppHandle, code: String, name: String) -> Result<(), String> {
    let (inviter, chain) = parse_code(&code)?;

    node(&app)?.join(inviter.into(), chain, name).await
}

#[tauri::command(async)]
pub fn p2p_leave(app: AppHandle) -> Result<(), String> {
    node(&app)?.leave();

    Ok(())
}

#[tauri::command(async)]
pub fn p2p_publish(app: AppHandle, snapshot: String) -> Result<(), String> {
    if snapshot.len() > MAX_FRAME {
        return Err("snapshot too large".into());
    }

    node(&app)?.publish(snapshot);

    Ok(())
}

#[tauri::command(async)]
pub async fn p2p_sync(app: AppHandle) -> Result<usize, String> {
    node(&app)?.sync().await
}
