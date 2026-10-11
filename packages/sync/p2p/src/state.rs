//! Persisted identity and membership state; callers retain ownership of locking.

use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use iroh::SecretKey;
use serde::{Deserialize, Serialize};

use super::protocol::{Peer, Revocation, Rotation};

const SENIORITY: u64 = 24 * 60 * 60 * 1000;
const RETIRED_LIMIT: usize = 8;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Saved {
    pub(super) key: [u8; 32],
    pub(super) chain: Option<[u8; 32]>,
    pub(super) name: String,
    pub(super) peers: Vec<Peer>,
    #[serde(default)]
    pub(super) joined_at: Option<u64>,
    #[serde(default)]
    pub(super) epoch: u64,
    #[serde(default)]
    pub(super) retired: Vec<[u8; 32]>,
    #[serde(default)]
    pub(super) revoked: Vec<Revocation>,
}

impl Saved {
    pub(super) fn fresh() -> Self {
        Self {
            key: random(),
            chain: None,
            name: String::new(),
            peers: Vec::new(),
            joined_at: None,
            epoch: 0,
            retired: Vec::new(),
            revoked: Vec::new(),
        }
    }

    pub(super) fn knows(&self, node_id: &str) -> bool {
        self.peers.iter().any(|peer| peer.node_id == node_id)
    }

    pub(super) fn revokes(&self, node_id: &str) -> bool {
        self.revoked.iter().any(|entry| entry.node_id == node_id)
    }

    // peers recorded before seniority tracking count as the oldest members
    pub(super) fn first_seen(&self, node_id: &str) -> Option<u64> {
        self.peers
            .iter()
            .find(|peer| peer.node_id == node_id)
            .map(|peer| peer.first_seen.unwrap_or(0))
    }

    pub(super) fn may_remove(&self, remover_since: u64, target: &str) -> bool {
        now().saturating_sub(remover_since) >= SENIORITY
            && self
                .first_seen(target)
                .is_none_or(|seen| seen >= remover_since)
    }

    pub(super) fn rotate(&mut self) {
        if let Some(old) = self.chain.replace(random()) {
            self.retired.insert(0, old);
            self.retired.truncate(RETIRED_LIMIT);
        }

        self.epoch += 1;
    }

    pub(super) fn forget(&mut self) {
        self.chain = None;
        self.peers.clear();
        self.joined_at = None;
        self.epoch = 0;
        self.retired.clear();
        self.revoked.clear();
    }

    // Returns false when an authorized revocation removes this node itself.
    pub(super) fn honor(&mut self, me: &str, revoked: Vec<Revocation>) -> bool {
        for entry in revoked {
            if self.revokes(&entry.node_id) {
                continue;
            }

            let Some(since) = self.first_seen(&entry.by) else {
                continue;
            };

            if entry.node_id == me {
                let mine = self.joined_at.unwrap_or(0);

                if now().saturating_sub(since) >= SENIORITY && mine >= since {
                    self.forget();

                    return false;
                }

                continue;
            }

            if self.may_remove(since, &entry.node_id) {
                self.peers.retain(|peer| peer.node_id != entry.node_id);
                self.revoked.push(entry);
            }
        }

        true
    }

    pub(super) fn adopt(&mut self, rotation: Rotation) {
        let Some(chain) = self.chain else {
            return;
        };

        if (rotation.epoch, rotation.chain) <= (self.epoch, chain) {
            return;
        }

        if rotation.chain != chain {
            self.retired.insert(0, chain);
            self.retired.truncate(RETIRED_LIMIT);
            self.chain = Some(rotation.chain);
        }

        self.epoch = rotation.epoch;
    }
}

pub(super) fn load(file: &Path) -> Option<Saved> {
    std::fs::read(file)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Saved>(&bytes).ok())
}

pub(super) fn persist(file: &Path, saved: &Saved) {
    let Ok(bytes) = serde_json::to_vec(saved) else {
        return;
    };

    let staging = file.with_extension("json.tmp");

    let _ = file.parent().map(std::fs::create_dir_all);

    if std::fs::write(&staging, bytes).is_ok() {
        let _ = std::fs::rename(staging, file);
    }
}

pub(super) fn random() -> [u8; 32] {
    SecretKey::generate().to_bytes()
}

pub(super) fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|since| since.as_millis() as u64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn legacy() -> Saved {
        serde_json::from_value(json!({
            "key": vec![1; 32],
            "chain": vec![2; 32],
            "name": "Local",
            "peers": [{"nodeId": "peer", "name": "Peer"}]
        }))
        .unwrap()
    }

    #[test]
    fn legacy_state_keeps_defaults_and_oldest_member_seniority() {
        let saved = legacy();
        assert_eq!(saved.joined_at, None);
        assert_eq!(saved.epoch, 0);
        assert!(saved.retired.is_empty());
        assert!(saved.revoked.is_empty());
        assert!(saved.knows("peer"));
        assert_eq!(saved.first_seen("peer"), Some(0));
        assert_eq!(saved.first_seen("unknown"), None);
        assert!(!saved.may_remove(1, "peer"));
        assert!(!saved.may_remove(u64::MAX, "unknown"));
    }

    #[test]
    fn persisted_json_keeps_membership_and_rotation_fields() {
        let mut saved = legacy();
        saved.joined_at = Some(12);
        saved.epoch = 3;
        saved.retired = vec![[4; 32]];
        saved.revoked.push(Revocation {
            node_id: "removed".into(),
            by: "peer".into(),
        });

        let expected = json!({
            "key": vec![1; 32],
            "chain": vec![2; 32],
            "name": "Local",
            "peers": [{
                "nodeId": "peer",
                "name": "Peer",
                "lastSeen": null,
                "firstSeen": null
            }],
            "joinedAt": 12,
            "epoch": 3,
            "retired": [vec![4; 32]],
            "revoked": [{"nodeId": "removed", "by": "peer"}]
        });
        assert_eq!(serde_json::to_value(&saved).unwrap(), expected);
        let restored: Saved = serde_json::from_slice(&serde_json::to_vec(&saved).unwrap()).unwrap();
        assert_eq!(serde_json::to_value(restored).unwrap(), expected);
    }

    #[test]
    fn rotation_retires_the_previous_chain_newest_first_and_bounds_history() {
        let mut saved = legacy();
        saved.retired = (3..=10).map(|byte| [byte; 32]).collect();
        saved.rotate();

        assert_eq!(saved.epoch, 1);
        assert_eq!(saved.retired.len(), RETIRED_LIMIT);
        assert_eq!(saved.retired[0], [2; 32]);
        assert_eq!(saved.retired[1], [3; 32]);
        assert_eq!(saved.retired[RETIRED_LIMIT - 1], [9; 32]);
        assert!(saved.chain.is_some());
    }

    #[test]
    fn forgetting_membership_preserves_identity_and_name() {
        let mut saved = legacy();
        saved.joined_at = Some(12);
        saved.epoch = 3;
        saved.retired = vec![[4; 32]];
        saved.revoked.push(Revocation {
            node_id: "removed".into(),
            by: "peer".into(),
        });
        saved.forget();

        assert_eq!(saved.key, [1; 32]);
        assert_eq!(saved.name, "Local");
        assert!(saved.chain.is_none());
        assert!(saved.peers.is_empty());
        assert!(saved.joined_at.is_none());
        assert_eq!(saved.epoch, 0);
        assert!(saved.retired.is_empty());
        assert!(saved.revoked.is_empty());
    }

    #[test]
    fn revocations_require_known_senior_authors_and_are_idempotent() {
        let mut saved = legacy();
        saved.peers.push(Peer {
            node_id: "target".into(),
            name: "Target".into(),
            last_seen: None,
            first_seen: Some(1),
            files: None,
        });
        assert!(saved.honor(
            "self",
            vec![Revocation {
                node_id: "target".into(),
                by: "unknown".into(),
            }]
        ));
        assert!(saved.knows("target"));
        assert!(saved.revoked.is_empty());

        let revocation = Revocation {
            node_id: "target".into(),
            by: "peer".into(),
        };
        assert!(saved.honor("self", vec![revocation.clone(), revocation]));
        assert!(!saved.knows("target"));
        assert!(saved.revokes("target"));
        assert_eq!(saved.revoked.len(), 1);

        saved.peers[0].first_seen = Some(u64::MAX);
        assert!(saved.honor(
            "self",
            vec![Revocation {
                node_id: "another".into(),
                by: "peer".into(),
            }]
        ));
        assert!(!saved.revokes("another"));
    }

    #[test]
    fn authorized_self_revocation_forgets_membership_and_stops_processing() {
        let mut saved = legacy();
        saved.joined_at = Some(12);
        assert!(!saved.honor(
            "self",
            vec![Revocation {
                node_id: "self".into(),
                by: "peer".into(),
            }]
        ));
        assert!(saved.chain.is_none());
        assert!(saved.peers.is_empty());
        assert!(saved.revoked.is_empty());
        assert_eq!(saved.key, [1; 32]);
        assert_eq!(saved.name, "Local");
    }

    #[test]
    fn adopting_rotations_keeps_epoch_then_chain_tie_breaking() {
        let mut saved = legacy();
        saved.epoch = 5;
        for (epoch, chain) in [(4, [9; 32]), (5, [1; 32]), (5, [2; 32])] {
            saved.adopt(Rotation { epoch, chain });
            assert_eq!(saved.chain, Some([2; 32]));
            assert_eq!(saved.epoch, 5);
            assert!(saved.retired.is_empty());
        }

        saved.adopt(Rotation {
            epoch: 5,
            chain: [3; 32],
        });
        assert_eq!(saved.chain, Some([3; 32]));
        assert_eq!(saved.retired, vec![[2; 32]]);

        saved.adopt(Rotation {
            epoch: 6,
            chain: [3; 32],
        });
        assert_eq!(saved.epoch, 6);
        assert_eq!(saved.retired, vec![[2; 32]]);

        saved.adopt(Rotation {
            epoch: 7,
            chain: [1; 32],
        });
        assert_eq!(saved.chain, Some([1; 32]));
        assert_eq!(saved.retired, vec![[3; 32], [2; 32]]);

        saved.forget();
        saved.adopt(Rotation {
            epoch: 8,
            chain: [9; 32],
        });
        assert!(saved.chain.is_none());
        assert_eq!(saved.epoch, 0);
        assert!(saved.retired.is_empty());
    }
}
