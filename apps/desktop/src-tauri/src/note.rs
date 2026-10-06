use std::io::Read;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

const SCHEME: &str = "arixlab-note";
const PREVIEW_BYTES: u64 = 64 * 1024;
const SNAPSHOT_BYTES: u64 = 16 * 1024 * 1024;
const PAGE_LIMIT: usize = 20;
const SCAN_LIMIT: usize = 20_000;
// arixlab-note reads and writes this same path under its own data folder; change both apps together
const BRIDGE_FILE: &str = r"bridge\events.json";
const NOTE_ID: &str = "com.arixlab.note";

#[derive(Deserialize)]
struct Bridge {
    vault: PathBuf,
}

fn note_dir() -> Option<PathBuf> {
    Some(PathBuf::from(std::env::var_os("APPDATA")?).join(NOTE_ID))
}

fn vault() -> Option<PathBuf> {
    let text = std::fs::read_to_string(note_dir()?.join("bridge.json")).ok()?;
    let bridge: Bridge = serde_json::from_str(&text).ok()?;

    bridge.vault.canonicalize().ok()
}

#[derive(Serialize)]
pub struct NoteStatus {
    installed: bool,
    vault: Option<String>,
    linked: bool,
}

#[derive(Serialize)]
pub struct NotePage {
    title: String,
    path: String,
}

fn relative(vault: &Path, file: &Path) -> Option<String> {
    let parts = file
        .strip_prefix(vault)
        .ok()?
        .components()
        .map(|part| part.as_os_str().to_str())
        .collect::<Option<Vec<_>>>()?;

    Some(parts.join("/"))
}

fn markdown(path: &Path) -> bool {
    path.extension().is_some_and(|extension| {
        extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("mdx")
    })
}

fn pages(vault: &Path, query: &str) -> Vec<NotePage> {
    let needle = query.to_lowercase();
    let mut found = Vec::new();
    let mut pending = vec![vault.to_path_buf()];
    let mut scanned = 0;

    while let Some(folder) = pending.pop() {
        let Ok(entries) = std::fs::read_dir(&folder) else {
            continue;
        };

        for entry in entries.flatten() {
            scanned += 1;

            if scanned > SCAN_LIMIT || found.len() >= PAGE_LIMIT {
                return found;
            }

            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                pending.push(path);
                continue;
            }

            let title = path
                .file_stem()
                .map(|stem| stem.to_string_lossy().to_string())
                .unwrap_or_default();

            if markdown(&path) && title.to_lowercase().contains(&needle) {
                if let Some(path) = relative(vault, &path) {
                    found.push(NotePage { title, path });
                }
            }
        }
    }

    found
}

fn plain(relative: &str) -> bool {
    !relative.contains(['\\', ':'])
        && relative
            .split('/')
            .all(|segment| !segment.is_empty() && segment != "." && segment != "..")
}

fn inside(vault: &Path, relative: &str) -> Option<PathBuf> {
    if !plain(relative) {
        return None;
    }

    let file = vault.join(relative).canonicalize().ok()?;

    (markdown(&file) && file.starts_with(vault)).then_some(file)
}

#[tauri::command(async)]
pub fn note_linkable() -> bool {
    win::scheme_registered(SCHEME)
}

#[tauri::command(async)]
pub fn note_status() -> NoteStatus {
    NoteStatus {
        installed: win::scheme_registered(SCHEME),
        vault: vault().map(|path| path.to_string_lossy().to_string()),
        linked: note_dir().is_some_and(|dir| dir.join(BRIDGE_FILE).is_file()),
    }
}

#[tauri::command(async)]
pub fn note_pages(query: String) -> Vec<NotePage> {
    vault()
        .map(|vault| pages(&vault, query.trim()))
        .unwrap_or_default()
}

#[tauri::command(async)]
pub fn note_bridge_publish(app: AppHandle, snapshot: String) -> Result<(), String> {
    let file = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(BRIDGE_FILE);
    let staged = file.with_extension("json.tmp");

    if let Some(folder) = file.parent() {
        std::fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    }

    std::fs::write(&staged, snapshot).map_err(|e| e.to_string())?;
    std::fs::rename(&staged, &file).map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn note_bridge_read() -> Option<String> {
    let file = std::fs::File::open(note_dir()?.join(BRIDGE_FILE)).ok()?;
    let mut text = String::new();

    file.take(SNAPSHOT_BYTES).read_to_string(&mut text).ok()?;

    Some(text)
}

#[tauri::command(async)]
pub fn note_preview(path: String) -> Result<String, String> {
    let vault = vault().ok_or("the Note vault is unknown")?;
    let file = inside(&vault, &path).ok_or("the note is not in the vault")?;
    let mut bytes = Vec::new();

    std::fs::File::open(file)
        .and_then(|file| file.take(PREVIEW_BYTES).read_to_end(&mut bytes))
        .map_err(|e| e.to_string())?;

    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

mod win {
    use windows::core::HSTRING;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, HKEY, HKEY_CLASSES_ROOT, KEY_READ,
    };

    pub fn scheme_registered(scheme: &str) -> bool {
        let mut key = HKEY::default();
        let opened = unsafe {
            RegOpenKeyExW(
                HKEY_CLASSES_ROOT,
                &HSTRING::from(scheme),
                None,
                KEY_READ,
                &mut key,
            )
        };

        if opened.is_err() {
            return false;
        }

        let _ = unsafe { RegCloseKey(key) };

        true
    }
}

#[cfg(test)]
mod tests {
    use super::{inside, pages};

    #[test]
    fn previews_stay_inside_the_vault() {
        let root = std::env::temp_dir().join("eris-note-vault-test");
        let vault = root.join("vault");

        std::fs::create_dir_all(vault.join("daily")).unwrap();
        std::fs::write(vault.join("daily").join("today.md"), "# Today").unwrap();
        std::fs::write(root.join("secret.md"), "outside").unwrap();
        std::fs::write(vault.join("image.png"), [0u8]).unwrap();

        let vault = vault.canonicalize().unwrap();

        assert!(inside(&vault, "daily/today.md").is_some());
        assert!(inside(&vault, "daily/./today.md").is_none());
        assert!(inside(&vault, "/daily/today.md").is_none());
        assert!(inside(&vault, r"daily\today.md").is_none());
        assert!(inside(&vault, "../secret.md").is_none());
        assert!(inside(&vault, &root.join("secret.md").to_string_lossy()).is_none());
        assert!(inside(&vault, "image.png").is_none());
    }

    #[test]
    fn page_search_lists_markdown_inside_the_vault() {
        let vault = std::env::temp_dir().join("eris-note-pages-test");

        std::fs::create_dir_all(vault.join("projects").join(".hidden")).unwrap();
        std::fs::write(vault.join("projects").join("Garden Plan.md"), "#").unwrap();
        std::fs::write(vault.join("projects").join("garden.png"), [0u8]).unwrap();
        std::fs::write(
            vault.join("projects").join(".hidden").join("garden.md"),
            "#",
        )
        .unwrap();

        let found = pages(&vault.canonicalize().unwrap(), "garden");

        assert_eq!(found.len(), 1);
        assert_eq!(found[0].path, "projects/Garden Plan.md");
        assert_eq!(found[0].title, "Garden Plan");
    }
}
