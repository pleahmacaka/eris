use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufReader, Read};

use serde::Deserialize;
use serde_json::Value;

use super::Summary;

const HEADER_LIMIT: u64 = 100 * 1024 * 1024;

#[derive(Deserialize)]
struct Entry {
    dtype: String,
    shape: Vec<u64>,
}

// The safetensors crate validates against the whole buffer; the header alone is all a preview needs.
pub fn read(file: File) -> Option<Summary> {
    let mut reader = BufReader::new(file);
    let mut length = [0; 8];
    reader.read_exact(&mut length).ok()?;
    let length = u64::from_le_bytes(length);

    if length > HEADER_LIMIT {
        return None;
    }

    let mut header = Vec::new();
    reader.take(length).read_to_end(&mut header).ok()?;
    let header: BTreeMap<String, Value> = serde_json::from_slice(&header).ok()?;

    let mut tensors = Summary::default();

    for (name, value) in header {
        if name == "__metadata__" {
            for (key, value) in value.as_object().into_iter().flatten() {
                let text = value
                    .as_str()
                    .map_or_else(|| value.to_string(), str::to_string);

                tensors.meta(key.clone(), text);
            }
        } else if let Ok(entry) = serde_json::from_value::<Entry>(value) {
            tensors.tensor(name, dtype(&entry.dtype), entry.shape);
        }
    }

    Some(tensors)
}

fn dtype(raw: &str) -> String {
    if raw == "BOOL" {
        return "bool".into();
    }

    if raw == "BF16" {
        return "bfloat16".into();
    }

    let mut chars = raw.chars();

    let kind = match chars.next() {
        Some('F') => "float",
        Some('I') => "int",
        Some('U') => "uint",
        _ => return raw.to_lowercase(),
    };

    format!("{kind}{}", chars.as_str().to_lowercase())
}
