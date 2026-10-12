use std::fs::OpenOptions;
use std::sync::Arc;
use std::time::Duration;

use eris_cli::store::{Store, now};
use eris_p2p::{Event, Node, write_private};
use tokio::sync::mpsc;

use crate::daemon::Paths;

const SYNC_EVERY: Duration = Duration::from_secs(60);

fn host_name() -> String {
    std::fs::read_to_string("/etc/hostname")
        .ok()
        .or_else(|| std::env::var("HOSTNAME").ok())
        .or_else(|| std::env::var("COMPUTERNAME").ok())
        .map(|name| name.trim().to_string())
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "Eris Sync".into())
}

// a membership change rotates the group secret, so the code on disk must follow it
fn publish_code(node: &Node, paths: &Paths) {
    let Some(code) = node.code() else {
        return;
    };

    if paths.read_code().as_deref() == Some(code.as_str()) {
        return;
    }

    if let Err(error) = write_private(&paths.code(), code.as_bytes()) {
        eprintln!("could not write the sync code: {error}");
    }
}

fn claim_files(paths: &Paths) -> Result<(), String> {
    let _ = std::fs::remove_file(paths.code());
    let _ = OpenOptions::new()
        .write(true)
        .truncate(true)
        .open(paths.log());

    write_private(&paths.pid(), std::process::id().to_string().as_bytes())
        .map_err(|e| e.to_string())
}

pub async fn serve(paths: &Paths) -> Result<(), String> {
    let _lock = paths.hold_lock()?;

    claim_files(paths)?;

    let (sender, mut events) = mpsc::unbounded_channel();
    let node = Arc::new(Node::open(
        &paths.dir,
        Box::new(move |event| {
            let _ = sender.send(event);
        }),
    )?);

    let device = format!("eris-sync-{}", node.status().node_id);
    let mut store = Store::open(&paths.dir, now())?;
    let name = host_name();

    node.publish(store.snapshot(&device, now()));
    node.invite(name.clone()).await?;
    publish_code(&node, paths);
    eprintln!("sync server online as {name}");

    let mut ticker = tokio::time::interval(SYNC_EVERY);

    loop {
        tokio::select! {
            _ = ticker.tick() => {
                node.publish(store.snapshot(&device, now()));

                match node.sync().await {
                    Ok(reached) => eprintln!("synced with {reached} device(s)"),
                    Err(error) => eprintln!("sync failed: {error}"),
                }

                publish_code(&node, paths);
            }
            Some(event) = events.recv() => match event {
                Event::Snapshot(snapshot) => {
                    if store.absorb(&snapshot, now()) {
                        if let Err(error) = store.persist(now()) {
                            eprintln!("could not save records: {error}");
                        }

                        node.publish(store.snapshot(&device, now()));
                    }
                }
                Event::Peers => publish_code(&node, paths),
            },
        }
    }
}
