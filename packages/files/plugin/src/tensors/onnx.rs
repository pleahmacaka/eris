use std::fs::File;
use std::io::{BufReader, Read};

use super::Summary;

const STRING_LIMIT: u64 = 1024 * 1024;

enum Field {
    Varint(u64),
    Bytes(u64),
}

struct Wire {
    reader: BufReader<File>,
    position: u64,
}

impl Wire {
    fn byte(&mut self) -> Option<u8> {
        let mut byte = [0];
        self.reader.read_exact(&mut byte).ok()?;
        self.position += 1;

        Some(byte[0])
    }

    fn varint(&mut self) -> Option<u64> {
        let mut value = 0;

        for shift in (0..64).step_by(7) {
            let byte = self.byte()?;
            value |= u64::from(byte & 0x7F) << shift;

            if byte & 0x80 == 0 {
                return Some(value);
            }
        }

        None
    }

    fn skip(&mut self, length: u64) -> Option<()> {
        self.reader
            .seek_relative(i64::try_from(length).ok()?)
            .ok()?;
        self.position += length;

        Some(())
    }

    fn string(&mut self, end: u64) -> Option<String> {
        let length = end.checked_sub(self.position)?;

        if length > STRING_LIMIT {
            return None;
        }

        let mut bytes = vec![0; usize::try_from(length).ok()?];
        self.reader.read_exact(&mut bytes).ok()?;
        self.position = end;

        Some(String::from_utf8_lossy(&bytes).into_owned())
    }

    fn message(
        &mut self,
        end: u64,
        mut each: impl FnMut(&mut Self, u64, Field) -> Option<()>,
    ) -> Option<()> {
        while self.position < end {
            let key = self.varint()?;
            let number = key >> 3;

            match key & 7 {
                0 => {
                    let value = self.varint()?;
                    each(self, number, Field::Varint(value))?;
                }
                1 => self.skip(8)?,
                2 => {
                    let length = self.varint()?;
                    let field_end = self.position.checked_add(length).filter(|at| *at <= end)?;
                    each(self, number, Field::Bytes(field_end))?;

                    match field_end.checked_sub(self.position)? {
                        0 => {}
                        rest => self.skip(rest)?,
                    }
                }
                5 => self.skip(4)?,
                _ => return None,
            }
        }

        (self.position == end).then_some(())
    }
}

fn dtype(code: u64) -> String {
    match code {
        1 => "float32",
        2 => "uint8",
        3 => "int8",
        4 => "uint16",
        5 => "int16",
        6 => "int32",
        7 => "int64",
        8 => "string",
        9 => "bool",
        10 => "float16",
        11 => "float64",
        12 => "uint32",
        13 => "uint64",
        14 => "complex64",
        15 => "complex128",
        16 => "bfloat16",
        17 => "float8e4m3fn",
        18 => "float8e4m3fnuz",
        19 => "float8e5m2",
        20 => "float8e5m2fnuz",
        21 => "uint4",
        22 => "int4",
        23 => "float4e2m1",
        _ => return format!("type {code}"),
    }
    .to_string()
}

pub fn read(file: File) -> Option<Summary> {
    let end = file.metadata().ok()?.len();
    let mut wire = Wire {
        reader: BufReader::new(file),
        position: 0,
    };
    let mut tensors = Summary::default();

    wire.message(end, |wire, number, field| {
        match (number, field) {
            (1, Field::Varint(version)) => tensors.meta("ir_version", version.to_string()),
            (2, Field::Bytes(end)) => tensors.meta("producer_name", wire.string(end)?),
            (3, Field::Bytes(end)) => tensors.meta("producer_version", wire.string(end)?),
            (7, Field::Bytes(end)) => graph(wire, end, &mut tensors)?,
            (8, Field::Bytes(end)) => {
                let (domain, version) = opset(wire, end)?;
                tensors.meta("opset_import", format!("{domain} {version}"));
            }
            (14, Field::Bytes(end)) => {
                let (key, value) = entry(wire, end)?;
                tensors.meta(key, value);
            }
            _ => {}
        }

        Some(())
    })?;

    Some(tensors)
}

fn graph(wire: &mut Wire, end: u64, tensors: &mut Summary) -> Option<()> {
    let mut nodes = 0;

    wire.message(end, |wire, number, field| {
        match (number, field) {
            (1, Field::Bytes(_)) => nodes += 1,
            (5, Field::Bytes(end)) => {
                let (name, dtype, shape) = initializer(wire, end)?;
                tensors.tensor(name, dtype, shape);
            }
            (11, Field::Bytes(end)) => tensors.meta("input", value_info(wire, end)?),
            (12, Field::Bytes(end)) => tensors.meta("output", value_info(wire, end)?),
            _ => {}
        }

        Some(())
    })?;

    tensors.meta("nodes", nodes.to_string());

    Some(())
}

fn initializer(wire: &mut Wire, end: u64) -> Option<(String, String, Vec<u64>)> {
    let mut name = String::new();
    let mut code = 0;
    let mut shape = Vec::new();

    wire.message(end, |wire, number, field| {
        match (number, field) {
            (1, Field::Varint(dim)) => shape.push(dim),
            (1, Field::Bytes(end)) => {
                while wire.position < end {
                    shape.push(wire.varint()?);
                }
            }
            (2, Field::Varint(value)) => code = value,
            (8, Field::Bytes(end)) => name = wire.string(end)?,
            _ => {}
        }

        Some(())
    })?;

    Some((name, dtype(code), shape))
}

fn value_info(wire: &mut Wire, end: u64) -> Option<String> {
    let mut name = String::new();
    let mut code = None;
    let mut dims = Vec::new();

    wire.message(end, |wire, number, field| {
        match (number, field) {
            (1, Field::Bytes(end)) => name = wire.string(end)?,
            (2, Field::Bytes(end)) => tensor_type(wire, end, &mut code, &mut dims)?,
            _ => {}
        }

        Some(())
    })?;

    let kind = code.map(dtype).unwrap_or_default();

    Some(format!("{name}: {kind} [{}]", dims.join(", ")))
}

fn tensor_type(
    wire: &mut Wire,
    end: u64,
    code: &mut Option<u64>,
    dims: &mut Vec<String>,
) -> Option<()> {
    wire.message(end, |wire, number, field| {
        if let (1, Field::Bytes(end)) = (number, field) {
            wire.message(end, |wire, number, field| {
                match (number, field) {
                    (1, Field::Varint(value)) => *code = Some(value),
                    (2, Field::Bytes(end)) => shape(wire, end, dims)?,
                    _ => {}
                }

                Some(())
            })?;
        }

        Some(())
    })
}

fn shape(wire: &mut Wire, end: u64, dims: &mut Vec<String>) -> Option<()> {
    wire.message(end, |wire, number, field| {
        if let (1, Field::Bytes(end)) = (number, field) {
            let mut dim = String::from("?");

            wire.message(end, |wire, number, field| {
                match (number, field) {
                    (1, Field::Varint(value)) => dim = (value as i64).to_string(),
                    (2, Field::Bytes(end)) => dim = wire.string(end)?,
                    _ => {}
                }

                Some(())
            })?;

            dims.push(dim);
        }

        Some(())
    })
}

fn opset(wire: &mut Wire, end: u64) -> Option<(String, u64)> {
    let mut domain = String::new();
    let mut version = 0;

    wire.message(end, |wire, number, field| {
        match (number, field) {
            (1, Field::Bytes(end)) => domain = wire.string(end)?,
            (2, Field::Varint(value)) => version = value,
            _ => {}
        }

        Some(())
    })?;

    if domain.is_empty() {
        domain = "ai.onnx".into();
    }

    Some((domain, version))
}

fn entry(wire: &mut Wire, end: u64) -> Option<(String, String)> {
    let mut key = String::new();
    let mut value = String::new();

    wire.message(end, |wire, number, field| {
        match (number, field) {
            (1, Field::Bytes(end)) => key = wire.string(end)?,
            (2, Field::Bytes(end)) => value = wire.string(end)?,
            _ => {}
        }

        Some(())
    })?;

    Some((key, value))
}
