use std::collections::BTreeMap;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::Value;

const MAX_CLOCK_SKEW: i64 = 24 * 60 * 60 * 1000;
const TOMBSTONE_TTL: i64 = 30 * 24 * 60 * 60 * 1000;
const MAX_SAFE_INTEGER: i64 = 9_007_199_254_740_991;

pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|since| since.as_millis() as i64)
        .unwrap_or_default()
}

fn poisoned(stamp: i64, now: i64) -> bool {
    !(-MAX_SAFE_INTEGER..=MAX_SAFE_INTEGER).contains(&stamp) || stamp > now + MAX_CLOCK_SKEW
}

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Collection {
    Todos,
    Events,
    Profile,
    Presets,
    Notes,
}

impl Collection {
    fn crosses_apps(self) -> bool {
        matches!(self, Self::Events)
    }
}

// mirrors isSyncRecord and remoteWins in packages/sync/src/merge.ts
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Record {
    collection: Collection,
    id: String,
    updated_at: i64,
    deleted: bool,
    device_id: String,
    #[serde(default)]
    data: Value,
}

impl Record {
    fn parse(value: Value, now: i64) -> Option<Self> {
        if !value.is_object() {
            return None;
        }

        let record: Self = serde_json::from_value(value).ok()?;
        let valid = !record.id.is_empty()
            && !record.device_id.is_empty()
            && !poisoned(record.updated_at, now)
            && (record.deleted || record.data.is_object());

        valid.then_some(record)
    }

    fn key(&self) -> (Collection, String) {
        (self.collection, self.id.clone())
    }

    fn beats(&self, local: Option<&Record>, now: i64) -> bool {
        local.is_none_or(|local| {
            poisoned(local.updated_at, now)
                || self.updated_at > local.updated_at
                || (self.updated_at == local.updated_at && self.device_id < local.device_id)
        })
    }

    fn expired(&self, now: i64) -> bool {
        self.deleted && self.updated_at < now - TOMBSTONE_TTL
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Outgoing<'a> {
    device_id: &'a str,
    app: &'static str,
    records: Vec<&'a Record>,
}

// mirrors readSnapshot: an `app` other than "eris", null included, only brings in events
fn incoming(snapshot: &str) -> Option<(bool, Vec<Value>)> {
    let Value::Object(mut envelope) = serde_json::from_str(snapshot).ok()? else {
        return None;
    };

    let foreign = envelope.get("app").is_some_and(|app| *app != "eris");
    let Value::Array(records) = envelope.remove("records")? else {
        return None;
    };

    Some((foreign, records))
}

pub struct Store {
    file: PathBuf,
    records: BTreeMap<(Collection, String), Record>,
}

impl Store {
    pub fn open(dir: &Path, now: i64) -> Result<Self, String> {
        let file = dir.join("records.json");
        let fail = |error: &dyn std::fmt::Display| format!("{}: {error}", file.display());
        let saved: Vec<Value> = match std::fs::read(&file) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(|e| fail(&e))?,
            Err(error) if error.kind() == ErrorKind::NotFound => Vec::new(),
            Err(error) => return Err(fail(&error)),
        };
        let mut store = Self {
            file,
            records: BTreeMap::new(),
        };

        store.merge(saved, false, now);

        Ok(store)
    }

    pub fn absorb(&mut self, snapshot: &str, now: i64) -> bool {
        incoming(snapshot).is_some_and(|(foreign, records)| self.merge(records, foreign, now))
    }

    // an expired tombstone still deletes what it beats, but is never kept
    fn merge(&mut self, records: Vec<Value>, foreign: bool, now: i64) -> bool {
        let mut changed = false;

        for record in records
            .into_iter()
            .filter_map(|value| Record::parse(value, now))
        {
            let key = record.key();

            if (foreign && !record.collection.crosses_apps())
                || !record.beats(self.records.get(&key), now)
            {
                continue;
            }

            if record.expired(now) {
                changed |= self.records.remove(&key).is_some();
            } else {
                self.records.insert(key, record);
                changed = true;
            }
        }

        changed
    }

    fn live(&self, now: i64) -> Vec<&Record> {
        self.records
            .values()
            .filter(|record| !record.expired(now))
            .collect()
    }

    pub fn persist(&self, now: i64) -> std::io::Result<()> {
        eris_p2p::write_private(&self.file, &serde_json::to_vec(&self.live(now))?)
    }

    pub fn snapshot(&self, device_id: &str, now: i64) -> String {
        serde_json::to_string(&Outgoing {
            device_id,
            app: "eris",
            records: self.live(now),
        })
        .unwrap_or_default()
    }
}
