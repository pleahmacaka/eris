use std::io::Read;
use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::error::{Error, Result};
use crate::launch;

const TEXT_LIMIT: u64 = 256 * 1024;

const SNIFF_LIMIT: u64 = 16 * 1024;

#[derive(Serialize)]
pub struct Model {
    obj: String,
    mtl: Option<String>,
}

#[tauri::command(async)]
pub fn allow_preview(app: AppHandle, path: String) -> Result<()> {
    if !Path::new(&path).is_file() {
        return Err(Error::Missing);
    }

    Ok(app.asset_protocol_scope().allow_file(&path)?)
}

#[tauri::command(async)]
pub fn preview_text(path: String) -> Result<String> {
    let mut bytes = Vec::new();

    std::fs::File::open(&path)?
        .take(TEXT_LIMIT)
        .read_to_end(&mut bytes)?;

    if let Some(rest) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        let units: Vec<u16> = rest
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect();

        return Ok(String::from_utf16_lossy(&units));
    }

    let body = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&bytes);

    if body.iter().take(8192).any(|byte| *byte == 0) {
        return Err(Error::Binary);
    }

    Ok(String::from_utf8_lossy(body).to_string())
}

fn material(obj: &Path) -> Option<String> {
    let mut head = String::new();

    std::fs::File::open(obj)
        .ok()?
        .take(64 * 1024)
        .read_to_string(&mut head)
        .ok();

    let named = head
        .lines()
        .find_map(|line| line.trim().strip_prefix("mtllib "))
        .map(|name| obj.with_file_name(name.trim()));

    named
        .into_iter()
        .chain(std::iter::once(obj.with_extension("mtl")))
        .find(|candidate| candidate.is_file())
        .map(|found| found.to_string_lossy().to_string())
}

#[tauri::command(async)]
pub fn model_files(app: AppHandle, path: String) -> Result<Model> {
    let obj = Path::new(&path);

    if !obj.is_file() {
        return Err(Error::Missing);
    }

    if let Some(folder) = obj.parent() {
        app.asset_protocol_scope()
            .allow_directory(folder, is_mujoco_file(obj))?;
    }

    Ok(Model {
        mtl: material(obj),
        obj: path,
    })
}

fn root_element(head: &str) -> Option<&str> {
    let mut rest = head.trim_start_matches('\u{feff}');

    loop {
        rest = rest.trim_start();

        if let Some(after) = rest.strip_prefix("<?") {
            rest = &after[after.find("?>")? + 2..];
        } else if let Some(after) = rest.strip_prefix("<!--") {
            rest = &after[after.find("-->")? + 3..];
        } else if let Some(after) = rest.strip_prefix("<!") {
            rest = &after[after.find('>')? + 1..];
        } else {
            break;
        }
    }

    let name = rest.strip_prefix('<')?;
    let end = name
        .find(|c: char| c.is_whitespace() || c == '>' || c == '/')
        .unwrap_or(name.len());

    Some(&name[..end])
}

fn is_mujoco_file(path: &Path) -> bool {
    let extension = path
        .extension()
        .map(|extension| extension.to_string_lossy().to_lowercase());

    match extension.as_deref() {
        Some("mjb") => true,
        Some("xml") => {
            let mut head = Vec::new();

            std::fs::File::open(path)
                .and_then(|file| file.take(SNIFF_LIMIT).read_to_end(&mut head))
                .is_ok()
                && root_element(&String::from_utf8_lossy(&head)) == Some("mujoco")
        }
        _ => false,
    }
}

#[tauri::command(async)]
pub fn is_mujoco(path: String) -> bool {
    is_mujoco_file(Path::new(&path))
}

#[tauri::command(async)]
pub fn open_viewer(app: AppHandle, path: String) -> Result<()> {
    launch::open_viewer(&app, path).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::root_element;

    #[test]
    fn finds_the_root_past_the_prolog() {
        let head = "\u{feff}<?xml version=\"1.0\"?>\n<!-- robot -->\n<!DOCTYPE x>\n<mujoco model=\"x2\">";

        assert_eq!(root_element(head), Some("mujoco"));
        assert_eq!(root_element("<mujoco/>"), Some("mujoco"));
        assert_eq!(root_element("<project>"), Some("project"));
        assert_eq!(root_element("<!-- unterminated"), None);
    }
}
