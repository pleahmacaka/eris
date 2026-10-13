use std::fs::File;
use std::io::{BufReader, Read, Seek};

use zip::ZipArchive;

use super::pickle::{self, Value};
use super::Summary;

const PICKLE_LIMIT: u64 = 256 * 1024 * 1024;

const LEGACY_HEADERS: usize = 3;

const MODULE_FIELDS: [&str; 3] = ["_parameters", "_buffers", "_modules"];

pub fn read(mut file: File) -> Option<Summary> {
    let archive = ZipArchive::new(BufReader::new(file.try_clone().ok()?));

    let root = match archive {
        Ok(mut archive) => archived(&mut archive)?,
        Err(_) => {
            file.rewind().ok()?;
            legacy(BufReader::new(file))?
        }
    };

    let mut tensors = Summary::default();
    walk(&root, "", 0, &mut tensors);

    (tensors.total > 0).then_some(tensors)
}

fn archived<R: Read + Seek>(archive: &mut ZipArchive<R>) -> Option<Value> {
    let name = archive
        .file_names()
        .find(|name| name.ends_with("/data.pkl") && name.matches('/').count() == 1)?
        .to_string();

    let entry = archive.by_name(&name).ok()?;

    pickle::load(BufReader::new(entry.take(PICKLE_LIMIT)))
}

fn legacy(mut reader: BufReader<File>) -> Option<Value> {
    for _ in 0..LEGACY_HEADERS {
        pickle::load(&mut reader)?;
    }

    pickle::load(reader)
}

fn key(value: &Value) -> Option<String> {
    match value {
        Value::Str(text) => Some(text.clone()),
        Value::Int(number) => Some(number.to_string()),
        _ => None,
    }
}

fn joined(prefix: &str, key: &str) -> String {
    if prefix.is_empty() {
        key.to_string()
    } else {
        format!("{prefix}.{key}")
    }
}

fn scalar(value: &Value) -> Option<String> {
    match value {
        Value::Str(text) => Some(text.clone()),
        Value::Int(number) => Some(number.to_string()),
        Value::Float(number) => Some(number.to_string()),
        Value::Bool(flag) => Some(flag.to_string()),
        _ => None,
    }
}

fn dtype(storage: &str) -> String {
    let kind = storage
        .rsplit('.')
        .next()
        .unwrap_or(storage)
        .trim_end_matches("Storage");

    match kind {
        "Float" => "float32",
        "Double" => "float64",
        "Half" => "float16",
        "BFloat16" => "bfloat16",
        "Long" => "int64",
        "Int" => "int32",
        "Short" => "int16",
        "Char" => "int8",
        "Byte" => "uint8",
        "Bool" => "bool",
        "ComplexFloat" => "complex64",
        "ComplexDouble" => "complex128",
        other => return other.to_lowercase(),
    }
    .to_string()
}

fn tensor(args: &[Value]) -> Option<(String, Vec<u64>)> {
    let Value::Persistent(id) = args.first()? else {
        return None;
    };

    let Value::Tuple(id) = id.as_ref() else {
        return None;
    };

    let Value::Global(storage) = id.get(1)? else {
        return None;
    };

    let Value::Tuple(size) = args.get(2)? else {
        return None;
    };

    let shape = size
        .iter()
        .map(|dim| match dim {
            Value::Int(dim) => u64::try_from(*dim).ok(),
            _ => None,
        })
        .collect::<Option<Vec<u64>>>()?;

    Some((dtype(storage), shape))
}

fn record(args: &[Value], name: &str, out: &mut Summary) {
    if let Some((dtype, shape)) = tensor(args) {
        out.tensor(name.to_string(), dtype, shape);
    }
}

fn walk(value: &Value, name: &str, depth: usize, out: &mut Summary) {
    match value {
        Value::Object { class, args, items } => match class.as_str() {
            "torch._utils._rebuild_tensor" | "torch._utils._rebuild_tensor_v2" => {
                record(args, name, out);
            }
            "torch._utils._rebuild_parameter" | "torch._utils._rebuild_parameter_with_state" => {
                if let Some(inner) = args.first() {
                    walk(inner, name, depth, out);
                }
            }
            "torch._tensor._rebuild_from_type_v2" => {
                if let Some(Value::Tuple(inner)) = args.get(2) {
                    record(inner, name, out);
                }
            }
            _ => entries(items, name, depth + 1, out),
        },
        Value::Dict(items) => entries(items, name, depth, out),
        Value::List(items) | Value::Tuple(items) => {
            for (index, item) in items.iter().enumerate() {
                walk(item, &joined(name, &index.to_string()), depth + 1, out);
            }
        }
        _ => {}
    }
}

fn entries(items: &[(Value, Value)], name: &str, depth: usize, out: &mut Summary) {
    for (item, value) in items {
        let Some(item) = key(item) else {
            continue;
        };

        match scalar(value) {
            Some(text) if depth == 0 => out.meta(item, text),
            Some(_) => {}
            None if MODULE_FIELDS.contains(&item.as_str()) => walk(value, name, depth + 1, out),
            None => walk(value, &joined(name, &item), depth + 1, out),
        }
    }
}
