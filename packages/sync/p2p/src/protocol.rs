//! Wire types, pairing codes, and length-prefixed JSON frames.

use std::fmt;

use data_encoding::BASE32_NOPAD_NOCASE;
use iroh::endpoint::{RecvStream, SendStream};
use iroh::EndpointId;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

pub(super) const ALPN: &[u8] = b"eris/sync/1";
pub(super) const MAX_FRAME: usize = 32 * 1024 * 1024;
pub(super) const MAX_HELLO: usize = 1024;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Peer {
    pub(super) node_id: String,
    pub(super) name: String,
    #[serde(default)]
    pub(super) last_seen: Option<u64>,
    #[serde(default)]
    pub(super) first_seen: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(super) files: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub(super) node_id: String,
    pub(super) paired: bool,
    pub(super) peers: Vec<Peer>,
    pub(super) removable: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Revocation {
    pub(super) node_id: String,
    pub(super) by: String,
}

#[derive(Clone, Copy, Serialize, Deserialize)]
pub(super) struct Rotation {
    pub(super) epoch: u64,
    pub(super) chain: [u8; 32],
}

#[derive(Serialize, Deserialize)]
pub(super) struct Hello {
    pub(super) secret: [u8; 32],
    #[serde(default)]
    pub(super) retired: Vec<[u8; 32]>,
}

#[derive(Serialize, Deserialize)]
pub(super) struct Exchange {
    pub(super) peers: Vec<Peer>,
    pub(super) snapshot: Option<String>,
    #[serde(default)]
    pub(super) revoked: Vec<Revocation>,
    #[serde(default)]
    pub(super) rotation: Option<Rotation>,
}

pub(super) fn same(a: &[u8; 32], b: &[u8; 32]) -> bool {
    a.iter().zip(b).fold(0, |diff, (x, y)| diff | (x ^ y)) == 0
}

pub(super) fn fail(error: impl fmt::Display) -> String {
    error.to_string()
}

pub(super) fn encode(bytes: &[u8; 32]) -> String {
    BASE32_NOPAD_NOCASE.encode(bytes).to_ascii_lowercase()
}

fn decode(text: &str) -> Option<[u8; 32]> {
    BASE32_NOPAD_NOCASE
        .decode(text.as_bytes())
        .ok()?
        .try_into()
        .ok()
}

pub(super) fn parse_code(code: &str) -> Result<(EndpointId, [u8; 32]), String> {
    let invalid = || "invalid pairing code".to_string();

    let (id, chain) = code.trim().split_once('.').ok_or_else(invalid)?;

    let id = decode(id)
        .and_then(|bytes| EndpointId::from_bytes(&bytes).ok())
        .ok_or_else(invalid)?;

    Ok((id, decode(chain).ok_or_else(invalid)?))
}

pub(super) async fn write<T: Serialize>(send: &mut SendStream, frame: &T) -> Result<(), String> {
    let bytes = serde_json::to_vec(frame).map_err(fail)?;

    if bytes.len() > MAX_FRAME {
        return Err("frame too large".into());
    }

    send.write_all(&(bytes.len() as u32).to_be_bytes())
        .await
        .map_err(fail)?;

    send.write_all(&bytes).await.map_err(fail)
}

pub(super) async fn read<T: DeserializeOwned>(
    recv: &mut RecvStream,
    limit: usize,
) -> Result<T, String> {
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

#[cfg(test)]
mod tests {
    use super::*;
    use iroh::SecretKey;
    use serde_json::json;

    #[test]
    fn pairing_codes_keep_case_insensitive_base32_and_outer_whitespace() {
        let id = SecretKey::from_bytes(&[7; 32]).public();
        let chain = [11; 32];
        let code = format!("{}.{}", encode(id.as_bytes()), encode(&chain));

        assert_eq!(parse_code(&code).unwrap(), (id, chain));
        assert_eq!(
            parse_code(&format!(" \n{}\t", code.to_ascii_uppercase())).unwrap(),
            (id, chain)
        );
        assert_eq!(code, code.to_ascii_lowercase());
    }

    #[test]
    fn pairing_codes_reject_missing_extra_and_wrong_length_parts() {
        let id = SecretKey::from_bytes(&[7; 32]).public();
        let id = encode(id.as_bytes());
        let chain = encode(&[11; 32]);

        for code in [
            String::new(),
            id.clone(),
            format!("{id}."),
            format!(".{chain}"),
            format!("{id}.{chain}.extra"),
            format!("{id}.aa"),
            format!("aa.{chain}"),
            format!("{id}.!"),
            format!("{id}. {chain}"),
        ] {
            assert_eq!(parse_code(&code).unwrap_err(), "invalid pairing code");
        }
    }

    #[test]
    fn legacy_exchange_and_peer_fields_keep_their_defaults() {
        let exchange: Exchange = serde_json::from_value(json!({
            "peers": [{"nodeId": "peer", "name": "Peer"}],
            "snapshot": null
        }))
        .unwrap();

        assert!(exchange.revoked.is_empty());
        assert!(exchange.rotation.is_none());
        let peer = &exchange.peers[0];
        assert!(peer.last_seen.is_none());
        assert!(peer.first_seen.is_none());
        assert!(peer.files.is_none());
        assert_eq!(
            serde_json::to_value(&exchange).unwrap(),
            json!({
                "peers": [{
                    "nodeId": "peer",
                    "name": "Peer",
                    "lastSeen": null,
                    "firstSeen": null
                }],
                "snapshot": null,
                "revoked": [],
                "rotation": null
            })
        );
    }

    #[test]
    fn hello_and_status_keep_their_json_shapes() {
        let hello: Hello = serde_json::from_value(json!({"secret": vec![3; 32]})).unwrap();
        assert!(hello.retired.is_empty());
        assert_eq!(
            serde_json::to_value(&hello).unwrap(),
            json!({"secret": vec![3; 32], "retired": []})
        );

        let status = Status {
            node_id: "self".into(),
            paired: true,
            peers: vec![Peer {
                node_id: "peer".into(),
                name: "Peer".into(),
                last_seen: Some(42),
                first_seen: Some(21),
                files: Some("files".into()),
            }],
            removable: vec!["peer".into()],
        };
        assert_eq!(
            serde_json::to_value(status).unwrap(),
            json!({
                "nodeId": "self",
                "paired": true,
                "peers": [{
                    "nodeId": "peer",
                    "name": "Peer",
                    "lastSeen": 42,
                    "firstSeen": 21,
                    "files": "files"
                }],
                "removable": ["peer"]
            })
        );
    }

    #[test]
    fn secret_comparison_checks_every_byte() {
        let secret = [9; 32];
        assert!(same(&secret, &secret));
        for index in 0..32 {
            let mut other = secret;
            other[index] ^= 1;
            assert!(!same(&secret, &other));
        }
    }
}
