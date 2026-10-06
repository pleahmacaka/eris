use std::collections::HashMap;
use std::fmt;
use std::sync::Arc;
use std::time::Duration;

use iroh::endpoint::{presets, Connection};
use iroh::protocol::{AcceptError, ProtocolHandler, Router};
use iroh::{Endpoint, EndpointId, SecretKey};
use iroh_blobs::api::downloader::Downloader;
use iroh_blobs::protocol::GetRequest;
use iroh_blobs::provider::events::{
    AbortReason, ConnectMode, EventMask, EventSender, ProviderMessage, RequestMode,
};
use iroh_blobs::store::fs::options::Options;
use iroh_blobs::store::fs::FsStore;
use iroh_blobs::store::GcConfig;
use iroh_blobs::BlobsProtocol;
use tokio::time::timeout;

use super::wire::{self, fail, Reply, Request, REPLY_LIMIT, REQUEST_LIMIT};
use super::Node;
use crate::error::{Error, Result};

pub(super) const DIAL_TIMEOUT: Duration = Duration::from_secs(20);
const SERVE_TIMEOUT: Duration = Duration::from_secs(30);
const GC_INTERVAL: Duration = Duration::from_secs(3_600);

pub(super) struct Net {
    pub(super) router: Router,
    pub(super) store: FsStore,
    pub(super) downloader: Downloader,
}

struct Control(Arc<Node>);

impl fmt::Debug for Control {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("Control")
    }
}

impl ProtocolHandler for Control {
    async fn accept(&self, connection: Connection) -> std::result::Result<(), AcceptError> {
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

fn verdict(allowed: bool) -> std::result::Result<(), AbortReason> {
    if allowed {
        Ok(())
    } else {
        Err(AbortReason::Permission)
    }
}

fn guard(node: Arc<Node>) -> EventSender {
    // iroh-blobs 0.103 gates every request kind on `mask.get`, so get_many, push and observe arrive here too
    let mask = EventMask {
        connected: ConnectMode::Intercept,
        get: RequestMode::Intercept,
        ..EventMask::DEFAULT
    };

    let (sender, mut events) = EventSender::channel(32, mask);

    tauri::async_runtime::spawn(async move {
        let mut peers: HashMap<u64, EndpointId> = HashMap::new();

        while let Some(event) = events.recv().await {
            match event {
                ProviderMessage::ClientConnected(message) => {
                    if let Some(peer) = message.endpoint_id {
                        peers.insert(message.connection_id, peer);
                    }

                    message.tx.send(Ok(())).await.ok();
                }
                ProviderMessage::ConnectionClosed(message) => {
                    peers.remove(&message.connection_id);
                }
                ProviderMessage::GetRequestReceived(message) => {
                    let allowed = peers
                        .get(&message.connection_id)
                        .is_some_and(|peer| node.may_serve(peer, &message.request));

                    message.tx.send(verdict(allowed)).await.ok();
                }
                ProviderMessage::GetManyRequestReceived(message) => {
                    message.tx.send(verdict(false)).await.ok();
                }
                ProviderMessage::PushRequestReceived(message) => {
                    message.tx.send(verdict(false)).await.ok();
                }
                ProviderMessage::ObserveRequestReceived(message) => {
                    message.tx.send(verdict(false)).await.ok();
                }
                _ => {}
            }
        }
    });

    sender
}

impl Node {
    pub(super) async fn net(self: &Arc<Self>) -> Result<&Net> {
        self.net
            .get_or_try_init(|| async {
                let blobs = self.dir.join("blobs");
                let mut options = Options::new(&blobs);

                options.gc = Some(GcConfig {
                    interval: GC_INTERVAL,
                    add_protected: None,
                });

                let store = FsStore::load_with_opts(blobs.join("blobs.db"), options)
                    .await
                    .map_err(fail)?;

                let key = SecretKey::from_bytes(&self.lock().key);

                let endpoint = Endpoint::builder(presets::N0)
                    .secret_key(key)
                    .bind()
                    .await
                    .map_err(fail)?;

                let downloader = store.downloader(&endpoint);
                let provider = BlobsProtocol::new(&store, Some(guard(self.clone())));

                let router = Router::builder(endpoint)
                    .accept(wire::ALPN, Control(self.clone()))
                    .accept(iroh_blobs::ALPN, provider)
                    .spawn();

                Ok::<_, Error>(Net {
                    router,
                    store,
                    downloader,
                })
            })
            .await
    }

    pub(super) async fn call(self: &Arc<Self>, to: EndpointId, request: Request) -> Result<Reply> {
        let net = self.net().await?;

        let exchange = async {
            let connection = net
                .router
                .endpoint()
                .connect(to, wire::ALPN)
                .await
                .map_err(|_| Error::Unreachable)?;
            let (mut send, mut recv) = connection.open_bi().await.map_err(fail)?;

            wire::write(&mut send, &request).await?;

            let reply = wire::read(&mut recv, REPLY_LIMIT).await?;

            connection.close(0u32.into(), b"done");

            Ok(reply)
        };

        timeout(DIAL_TIMEOUT, exchange)
            .await
            .unwrap_or(Err(Error::Unreachable))
    }

    async fn serve(self: &Arc<Self>, connection: &Connection) -> Result<()> {
        let remote = connection.remote_id();
        let (mut send, mut recv) = connection.accept_bi().await.map_err(fail)?;
        let request = wire::read(&mut recv, REQUEST_LIMIT).await?;

        let reply = match request {
            Request::Browse { path } => self.browsed(remote, path).await,
            Request::Fetch { path } => self.fetched(remote, path).await,
            request => self.answer(remote, request),
        };

        wire::write(&mut send, &reply).await
    }

    fn answer(self: &Arc<Self>, remote: EndpointId, request: Request) -> Reply {
        match request {
            Request::Pair { secret, name } => self.pair(remote, secret, name),
            Request::Ask { share } => self.manifest_for(&remote, share),
            Request::Received { share } => self.record_download(remote, share),
            _ if !self.knows(&remote) => Reply::Denied,
            Request::Offer { share } => self.offered(remote, share),
            Request::SyncInvite { sync, name } => self.invited(remote, sync, name),
            Request::SyncIndex { sync } => self.index_reply(&remote, sync),
            Request::SyncChanged { sync } => self.wake_sync(&remote, sync),
            Request::Evict { device } => self.evicted(remote, &device),
            Request::Browse { .. } | Request::Fetch { .. } | Request::Unknown => Reply::Denied,
        }
    }

    fn may_serve(&self, peer: &EndpointId, request: &GetRequest) -> bool {
        if request.ranges.is_blob() && self.gate.lock().unwrap().holds(peer, &request.hash) {
            return true;
        }

        let saved = self.lock();

        let shared = saved
            .shares
            .iter()
            .any(|share| share.hash == request.hash && share.reaches(peer));

        if shared {
            return true;
        }

        if !request.ranges.is_blob() || !saved.knows(peer) {
            return false;
        }

        let hashes = self.sync_hashes.lock().unwrap();

        saved
            .syncs
            .iter()
            .filter(|sync| !sync.paused && sync.device == *peer)
            .filter_map(|sync| hashes.get(&sync.id))
            .any(|held| held.contains(&request.hash))
    }
}
