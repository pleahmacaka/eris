use std::fs::File;
use std::io::{BufReader, Cursor, Read};

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
    let mut prefix = [0; 8];
    reader.read_exact(&mut prefix).ok()?;

    if &prefix[..6] != b"\x93NUMPY" {
        return None;
    }

    let length_size = if prefix[6] == 1 { 2 } else { 4 };
    let mut length_bytes = [0; 4];
    reader.read_exact(&mut length_bytes[..length_size]).ok()?;
    let header_length = if length_size == 2 {
        usize::from(u16::from_le_bytes([length_bytes[0], length_bytes[1]]))
    } else {
        usize::try_from(u32::from_le_bytes(length_bytes)).ok()?
    };

    if header_length > HEADER_LIMIT {
        return None;
    }

    // Keep the existing allocation limit before handing the header to the parser.
    let mut preamble = Vec::with_capacity(8 + length_size);
    preamble.extend_from_slice(&prefix);
    preamble.extend_from_slice(&length_bytes[..length_size]);
    let header = npyz::NpyHeader::from_reader(Cursor::new(preamble).chain(reader)).ok()?;

    Some((dtype(header.dtype()), header.shape().to_vec()))
}

fn dtype(value: npyz::DType) -> String {
    let npyz::DType::Plain(value) = value else {
        return "structured".into();
    };

    let fallback = || {
        value
            .to_string()
            .trim_start_matches(['<', '>', '|', '='])
            .to_string()
    };

    if value.type_char() == npyz::TypeChar::Bool {
        return "bool".into();
    }

    let Some(bits) = value.size_field().checked_mul(8) else {
        return fallback();
    };

    match value.type_char() {
        npyz::TypeChar::Float => format!("float{bits}"),
        npyz::TypeChar::Int => format!("int{bits}"),
        npyz::TypeChar::Uint => format!("uint{bits}"),
        npyz::TypeChar::Complex => format!("complex{bits}"),
        _ => fallback(),
    }
}
