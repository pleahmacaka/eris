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
        let head =
            "\u{feff}<?xml version=\"1.0\"?>\n<!-- robot -->\n<!DOCTYPE x>\n<mujoco model=\"x2\">";

        assert_eq!(root_element(head), Some("mujoco"));
        assert_eq!(root_element("<mujoco/>"), Some("mujoco"));
        assert_eq!(root_element("<project>"), Some("project"));
        assert_eq!(root_element("<!-- unterminated"), None);
    }
}

const HEX_PAGE: u64 = 64 * 1024;

const SEARCH_CHUNK: usize = 1024 * 1024;

#[tauri::command(async)]
pub fn read_bytes(path: String, offset: u64, length: u64) -> Result<tauri::ipc::Response> {
    use std::io::{Seek, SeekFrom};

    let mut file = std::fs::File::open(&path)?;
    let mut bytes = Vec::new();

    file.seek(SeekFrom::Start(offset))?;
    file.take(length.min(HEX_PAGE)).read_to_end(&mut bytes)?;

    Ok(tauri::ipc::Response::new(bytes))
}

// scans forward from `from` and wraps to the start, carrying the needle's tail across chunk edges
#[tauri::command(async)]
pub fn find_bytes(path: String, needle: Vec<u8>, from: u64) -> Result<Option<u64>> {
    use std::io::{Seek, SeekFrom};

    if needle.is_empty() {
        return Ok(None);
    }

    let mut file = std::fs::File::open(&path)?;
    let size = file.metadata()?.len();
    let start = from.min(size);

    let mut scan = |begin: u64, end: u64| -> Result<Option<u64>> {
        file.seek(SeekFrom::Start(begin))?;

        let mut base = begin;
        let mut carry: Vec<u8> = Vec::new();
        let mut chunk = vec![0; SEARCH_CHUNK];

        while base < end {
            let want = (end - base).min(SEARCH_CHUNK as u64) as usize;
            let read = file.read(&mut chunk[..want])?;

            if read == 0 {
                break;
            }

            let mut window = std::mem::take(&mut carry);
            let window_start = base - window.len() as u64;

            window.extend_from_slice(&chunk[..read]);

            if let Some(at) = window.windows(needle.len()).position(|part| part == needle) {
                return Ok(Some(window_start + at as u64));
            }

            let keep = (needle.len() - 1).min(window.len());

            carry = window[window.len() - keep..].to_vec();
            base += read as u64;
        }

        Ok(None)
    };

    if let Some(found) = scan(start, size)? {
        return Ok(Some(found));
    }

    scan(0, (start + needle.len() as u64).min(size))
}
