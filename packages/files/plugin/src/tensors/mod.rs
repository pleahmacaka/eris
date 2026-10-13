mod numpy;
mod onnx;
mod parquet;
mod pickle;
mod safetensors;
mod torch;

use std::fs::File;
use std::path::Path;

use serde::Serialize;

use crate::error::{Error, Result};
use crate::listing::extension;

const SHOWN: usize = 500;

#[derive(Serialize)]
pub struct Tensor {
    name: String,
    dtype: String,
    shape: Vec<u64>,
}

#[derive(Serialize, Default)]
struct Summary {
    tensors: Vec<Tensor>,
    rows: Option<u64>,
    total: usize,
    parameters: u64,
    metadata: Vec<(String, String)>,
}

#[derive(Serialize)]
pub struct Tensors {
    format: &'static str,
    #[serde(flatten)]
    summary: Summary,
}

impl Summary {
    fn tensor(&mut self, name: String, dtype: String, shape: Vec<u64>) {
        let count = shape
            .iter()
            .try_fold(1u64, |total, dim| total.checked_mul(*dim))
            .unwrap_or(u64::MAX);

        self.total += 1;
        self.parameters = self.parameters.saturating_add(count);

        if self.tensors.len() < SHOWN {
            self.tensors.push(Tensor { name, dtype, shape });
        }
    }

    fn meta(&mut self, key: impl Into<String>, value: impl Into<String>) {
        if self.metadata.len() < SHOWN {
            self.metadata.push((key.into(), value.into()));
        }
    }
}

#[tauri::command(async)]
pub fn inspect_tensors(path: String) -> Result<Tensors> {
    let name = Path::new(&path)
        .file_stem()
        .map(|stem| stem.to_string_lossy().into_owned())
        .unwrap_or_default();
    let file = File::open(&path)?;

    let (format, summary) = match extension(&path).as_str() {
        ".safetensors" => ("Safetensors", safetensors::read(file)),
        ".pt" | ".pth" | ".ckpt" => ("PyTorch", torch::read(file)),
        ".onnx" => ("ONNX", onnx::read(file)),
        ".npz" => ("NumPy", numpy::archive(file)),
        ".npy" => ("NumPy", numpy::array(file, name)),
        ".parquet" => ("Parquet", parquet::read(file)),
        _ => return Err(Error::Unsupported),
    };

    Ok(Tensors {
        format,
        summary: summary.ok_or(Error::Unsupported)?,
    })
}
