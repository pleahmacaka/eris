use std::fmt;
use std::path::{Path, PathBuf};

use data_encoding::BASE32_NOPAD_NOCASE;
use iroh::endpoint::{RecvStream, SendStream};
use iroh::EndpointId;
use iroh_blobs::Hash;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use tauri::Url;
use uuid::Uuid;

use crate::error::{Error, Result};

pub const ALPN: &[u8] = b"eris/files/1";
pub const REQUEST_LIMIT: usize = 16 * 1024;
pub const REPLY_LIMIT: usize = 64 * 1024 * 1024;

pub const SCHEME: &str = "eris-files";

const RESERVED: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub name: String,
    pub size: u64,
    pub files: u64,
    pub dir: bool,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    pub hash: Hash,
    pub items: Vec<Item>,
    pub total: u64,
    pub from: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub path: String,
    pub hash: Hash,
    pub size: u64,
    pub modified: u64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteEntry {
    pub name: String,
    pub path: String,
    pub dir: bool,
    pub size: u64,
    pub modified: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Request {
    Pair {
        secret: [u8; 32],
        name: String,
    },
    Ask {
        share: Uuid,
    },
    Offer {
        share: Uuid,
    },
    Received {
        share: Uuid,
    },
    SyncInvite {
        sync: Uuid,
        name: String,
    },
    SyncIndex {
        sync: Uuid,
    },
    SyncChanged {
        sync: Uuid,
    },
    Evict {
        device: String,
    },
    Browse {
        path: Option<String>,
    },
    Fetch {
        path: String,
    },
    #[serde(other)]
    Unknown,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum Reply {
    Welcome { name: String },
    Manifest { manifest: Manifest },
    Index { entries: Vec<Entry> },
    Listing {
        path: Option<String>,
        entries: Vec<RemoteEntry>,
    },
    Blob {
        hash: Hash,
        size: u64,
        name: String,
    },
    Pending,
    Accepted,
    Denied,
}

pub enum Link {
    Share { id: Uuid, from: EndpointId },
    Pair(String),
}

pub fn fail(error: impl fmt::Display) -> Error {
    Error::Os(error.to_string())
}

pub fn encode(bytes: &[u8; 32]) -> String {
    BASE32_NOPAD_NOCASE.encode(bytes).to_ascii_lowercase()
}

fn decode(text: &str) -> Option<[u8; 32]> {
    BASE32_NOPAD_NOCASE
        .decode(text.as_bytes())
        .ok()?
        .try_into()
        .ok()
}

pub fn decode_id(text: &str) -> Option<EndpointId> {
    decode(text).and_then(|bytes| EndpointId::from_bytes(&bytes).ok())
}

pub fn share_link(id: &Uuid, from: &EndpointId) -> String {
    format!("{SCHEME}://share/{id}?from={}", encode(from.as_bytes()))
}

pub fn pair_link(code: &str) -> String {
    format!("{SCHEME}://pair/{code}")
}

pub fn is_link(text: &str) -> bool {
    text.get(..SCHEME.len() + 1)
        .is_some_and(|head| head.eq_ignore_ascii_case(&format!("{SCHEME}:")))
}

pub fn parse_link(text: &str) -> Option<Link> {
    let url = Url::parse(text.trim()).ok()?;

    if url.scheme() != SCHEME {
        return None;
    }

    let segment = url.path().trim_matches('/');

    match url.host_str()? {
        "share" => {
            let id = Uuid::parse_str(segment).ok()?;
            let from = url
                .query_pairs()
                .find(|(key, _)| key == "from")
                .and_then(|(_, value)| decode_id(&value))?;

            Some(Link::Share { id, from })
        }
        "pair" => parse_code(segment)
            .ok()
            .map(|_| Link::Pair(segment.to_string())),
        _ => None,
    }
}

pub fn parse_code(text: &str) -> Result<(EndpointId, [u8; 32])> {
    let text = text.trim();

    if is_link(text) {
        return match parse_link(text) {
            Some(Link::Pair(code)) => parse_code(&code),
            _ => Err(Error::Invalid),
        };
    }

    let (id, secret) = text.split_once('.').ok_or(Error::Invalid)?;
    let id = decode_id(id).ok_or(Error::Invalid)?;

    Ok((id, decode(secret).ok_or(Error::Invalid)?))
}

pub fn safe_relative(name: &str) -> Option<PathBuf> {
    let mut path = PathBuf::new();

    for segment in name.split('/') {
        let stem = segment.split('.').next().unwrap_or_default();
        let unsafe_segment = segment.is_empty()
            || segment.ends_with(['.', ' '])
            || segment
                .chars()
                .any(|c| c.is_control() || r#"<>:"\|?*"#.contains(c))
            || RESERVED.contains(&stem.to_ascii_uppercase().as_str());

        if unsafe_segment {
            return None;
        }

        path.push(segment);
    }

    Some(path)
}

pub fn vacant(folder: &Path, name: &str) -> PathBuf {
    let first = folder.join(name);

    if !first.exists() {
        return first;
    }

    let (stem, extension) = match name.rsplit_once('.') {
        Some((stem, extension)) if !stem.is_empty() => (stem, format!(".{extension}")),
        _ => (name, String::new()),
    };

    (1..)
        .map(|n| folder.join(format!("{stem} ({n}){extension}")))
        .find(|path| !path.exists())
        .unwrap_or(first)
}

pub async fn write<T: Serialize>(send: &mut SendStream, frame: &T) -> Result<()> {
    let bytes = serde_json::to_vec(frame).map_err(fail)?;

    send.write_all(&bytes).await.map_err(fail)?;
    send.finish().map_err(fail)
}

pub async fn read<T: DeserializeOwned>(recv: &mut RecvStream, limit: usize) -> Result<T> {
    let bytes = recv.read_to_end(limit).await.map_err(fail)?;

    serde_json::from_slice(&bytes).map_err(fail)
}
