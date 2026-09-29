use std::io::Read;
use std::path::{Path, PathBuf};

use serde::Deserialize;

const SCHEME: &str = "arixlab-note";
const PREVIEW_BYTES: u64 = 64 * 1024;

#[derive(Deserialize)]
struct Bridge {
    vault: PathBuf,
}

fn vault() -> Option<PathBuf> {
    let appdata = PathBuf::from(std::env::var_os("APPDATA")?);
    let text = std::fs::read_to_string(appdata.join(r"com.arixlab.note\bridge.json")).ok()?;
    let bridge: Bridge = serde_json::from_str(&text).ok()?;

    bridge.vault.canonicalize().ok()
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
    let markdown = file.extension().is_some_and(|extension| {
        extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("mdx")
    });

    (markdown && file.starts_with(vault)).then_some(file)
}

#[tauri::command(async)]
pub fn note_linkable() -> bool {
    win::scheme_registered(SCHEME)
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

#[cfg(target_os = "windows")]
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

#[cfg(not(target_os = "windows"))]
mod win {
    pub fn scheme_registered(_scheme: &str) -> bool {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::inside;

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
}
