use std::path::PathBuf;

use eris_cli::store::Store;
use serde_json::{Value, json};

const FIXTURES: &str = include_str!("../../../packages/sync/fixtures/merge.json");
const DAY: i64 = 24 * 60 * 60 * 1000;

fn fixtures() -> Value {
    serde_json::from_str(FIXTURES).unwrap()
}

fn empty_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("eris-cli-store-{}-{name}", std::process::id()));

    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();

    dir
}

fn ids(store: &Store, now: i64) -> Vec<String> {
    let snapshot: Value = serde_json::from_str(&store.snapshot("server", now)).unwrap();
    let mut ids: Vec<String> = snapshot["records"]
        .as_array()
        .unwrap()
        .iter()
        .map(|record| record["id"].as_str().unwrap().to_string())
        .collect();

    ids.sort();

    ids
}

fn todo(id: &str, updated_at: i64, device_id: &str, deleted: bool) -> Value {
    json!({
        "collection": "todos",
        "id": id,
        "updatedAt": updated_at,
        "deleted": deleted,
        "deviceId": device_id,
        "data": if deleted { Value::Null } else { json!({}) },
    })
}

fn snapshot(records: Vec<Value>) -> String {
    json!({ "deviceId": "peer", "app": "eris", "records": records }).to_string()
}

#[test]
fn shared_read_fixtures_match_the_typescript_reader() {
    let fixtures = fixtures();
    let now = fixtures["now"].as_i64().unwrap();

    for case in fixtures["read"].as_array().unwrap() {
        let mut store = Store::open(&empty_dir("read"), now).unwrap();
        let mut accepted: Vec<String> = case["accepted"]
            .as_array()
            .unwrap()
            .iter()
            .map(|id| id.as_str().unwrap().to_string())
            .collect();

        accepted.sort();
        store.absorb(&case["snapshot"].to_string(), now);

        assert_eq!(ids(&store, now), accepted, "{}", case["name"]);
    }
}

#[test]
fn shared_wins_fixtures_match_remote_wins() {
    let fixtures = fixtures();
    let now = fixtures["now"].as_i64().unwrap();

    for case in fixtures["wins"].as_array().unwrap() {
        let field = |side: &str, key: &str| case[side][key].clone();
        let mut store = Store::open(&empty_dir("wins"), now).unwrap();

        store.absorb(
            &snapshot(vec![todo(
                "a",
                field("local", "updatedAt").as_i64().unwrap(),
                field("local", "deviceId").as_str().unwrap(),
                false,
            )]),
            now,
        );

        let changed = store.absorb(
            &snapshot(vec![todo(
                "a",
                field("remote", "updatedAt").as_i64().unwrap(),
                field("remote", "deviceId").as_str().unwrap(),
                false,
            )]),
            now,
        );

        assert_eq!(changed, case["wins"].as_bool().unwrap(), "{}", case["name"]);
    }
}

#[test]
fn an_expired_tombstone_deletes_what_it_beats_without_being_kept() {
    let now = fixtures()["now"].as_i64().unwrap();
    let mut store = Store::open(&empty_dir("expired"), now).unwrap();

    store.absorb(
        &snapshot(vec![todo("a", now - 40 * DAY, "dev-a", false)]),
        now,
    );

    assert!(store.absorb(
        &snapshot(vec![todo("a", now - 31 * DAY, "dev-b", true)]),
        now
    ));
    assert!(ids(&store, now).is_empty());
    assert!(!store.absorb(
        &snapshot(vec![todo("b", now - 31 * DAY, "dev-b", true)]),
        now
    ));
}

#[test]
fn tombstones_expire_from_snapshots_and_saved_records() {
    let now = fixtures()["now"].as_i64().unwrap();
    let dir = empty_dir("prune");
    let mut store = Store::open(&dir, now).unwrap();

    store.absorb(
        &snapshot(vec![todo("a", now - 29 * DAY, "dev-b", true)]),
        now,
    );
    store.persist(now).unwrap();

    let later = now + 2 * DAY;

    assert!(ids(&store, later).is_empty());
    assert!(ids(&Store::open(&dir, later).unwrap(), later).is_empty());
    assert_eq!(ids(&Store::open(&dir, now).unwrap(), now), ["a"]);
}

#[test]
fn an_unreadable_record_file_is_an_error_not_an_empty_store() {
    let dir = empty_dir("corrupt");

    std::fs::write(dir.join("records.json"), "{").unwrap();

    assert!(Store::open(&dir, 0).is_err());
}
