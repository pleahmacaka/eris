use std::fs::File;
use std::io::{BufReader, Read};

use zip::ZipArchive;

use super::Summary;

const HEADER_LIMIT: usize = 1024 * 1024;

pub fn archive(file: File) -> Option<Summary> {
    let mut archive = ZipArchive::new(BufReader::new(file)).ok()?;
    let mut tensors = Summary::default();

    for index in 0..archive.len() {
        let Ok(entry) = archive.by_index(index) else {
            continue;
        };

        let Some(name) = entry.name().strip_suffix(".npy").map(str::to_string) else {
            continue;
        };

        if let Some((dtype, shape)) = header(entry) {
            tensors.tensor(name, dtype, shape);
        }
    }

    (tensors.total > 0).then_some(tensors)
}

pub fn array(file: File, name: String) -> Option<Summary> {
    let (dtype, shape) = header(BufReader::new(file))?;
    let mut tensors = Summary::default();
    tensors.tensor(name, dtype, shape);

    Some(tensors)
}

fn header(mut reader: impl Read) -> Option<(String, Vec<u64>)> {
    let mut magic = [0; 8];
    reader.read_exact(&mut magic).ok()?;

    if &magic[..6] != b"\x93NUMPY" {
        return None;
    }

    let length = if magic[6] == 1 {
        let mut length = [0; 2];
        reader.read_exact(&mut length).ok()?;
        usize::from(u16::from_le_bytes(length))
    } else {
        let mut length = [0; 4];
        reader.read_exact(&mut length).ok()?;
        usize::try_from(u32::from_le_bytes(length)).ok()?
    };

    if length > HEADER_LIMIT {
        return None;
    }

    let mut text = vec![0; length];
    reader.read_exact(&mut text).ok()?;
    let text = String::from_utf8_lossy(&text);

    Some((
        dtype(field(&text, "descr")?),
        shape(field(&text, "shape")?)?,
    ))
}

fn field<'a>(text: &'a str, key: &str) -> Option<&'a str> {
    let quoted = format!("'{key}'");
    let start = text.find(&quoted)? + quoted.len();

    Some(text[start..].trim_start_matches([':', ' ']))
}

fn dtype(value: &str) -> String {
    let Some(quoted) = value.strip_prefix('\'') else {
        return "structured".into();
    };

    let code = quoted
        .split('\'')
        .next()
        .unwrap_or_default()
        .trim_start_matches(['<', '>', '|', '=']);

    let mut chars = code.chars();
    let kind = chars.next();
    let bits = chars.as_str().parse::<u32>().ok().map(|bytes| bytes * 8);

    match (kind, bits) {
        (Some('b'), _) => "bool".into(),
        (Some('f'), Some(bits)) => format!("float{bits}"),
        (Some('i'), Some(bits)) => format!("int{bits}"),
        (Some('u'), Some(bits)) => format!("uint{bits}"),
        (Some('c'), Some(bits)) => format!("complex{bits}"),
        _ => code.to_string(),
    }
}

fn shape(value: &str) -> Option<Vec<u64>> {
    let inner = value.strip_prefix('(')?;
    let inner = &inner[..inner.find(')')?];

    inner
        .split(',')
        .map(str::trim)
        .filter(|dim| !dim.is_empty())
        .map(|dim| dim.parse().ok())
        .collect()
}
