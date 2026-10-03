use std::path::{Path, PathBuf};

use windows::Win32::Foundation::{LocalFree, HLOCAL};
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
};

fn file(folder: &Path, key: &str) -> Result<PathBuf, String> {
    let valid = !key.is_empty()
        && key.len() <= 128
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));

    if valid {
        Ok(folder.join(format!("{key}.bin")))
    } else {
        Err("invalid".into())
    }
}

fn blob(bytes: &[u8]) -> CRYPT_INTEGER_BLOB {
    CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    }
}

fn take(output: CRYPT_INTEGER_BLOB) -> Vec<u8> {
    let bytes = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();

    unsafe {
        LocalFree(Some(HLOCAL(output.pbData as _)));
    }

    bytes
}

fn seal(plain: &[u8]) -> Result<Vec<u8>, String> {
    let mut output = CRYPT_INTEGER_BLOB::default();

    unsafe {
        CryptProtectData(
            &blob(plain),
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    }
    .map_err(|e| e.message())?;

    Ok(take(output))
}

fn open(sealed: &[u8]) -> Result<Vec<u8>, String> {
    let mut output = CRYPT_INTEGER_BLOB::default();

    unsafe {
        CryptUnprotectData(
            &blob(sealed),
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    }
    .map_err(|e| e.message())?;

    Ok(take(output))
}

pub fn load(folder: &Path, key: &str) -> Result<Option<String>, String> {
    let Ok(sealed) = std::fs::read(file(folder, key)?) else {
        return Ok(None);
    };

    Ok(open(&sealed)
        .ok()
        .and_then(|plain| String::from_utf8(plain).ok()))
}

pub fn store(folder: &Path, key: &str, value: &str) -> Result<(), String> {
    let target = file(folder, key)?;
    let partial = target.with_extension("tmp");

    std::fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    std::fs::write(&partial, seal(value.as_bytes())?).map_err(|e| e.to_string())?;

    // other Eris apps read this file concurrently, so it must never be seen half written
    std::fs::rename(&partial, &target).map_err(|e| e.to_string())
}

pub fn forget(folder: &Path, key: &str) -> Result<(), String> {
    match std::fs::remove_file(file(folder, key)?) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(e.to_string()),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::{forget, load, store};

    #[test]
    fn round_trips_a_sealed_value_and_rejects_path_keys() {
        let folder = std::env::temp_dir().join("eris-auth-vault-check");

        store(&folder, "sb-test-auth-token", "{\"a\":1}").unwrap();

        assert!(!std::fs::read(folder.join("sb-test-auth-token.bin"))
            .unwrap()
            .windows(7)
            .any(|w| w == b"{\"a\":1}"));
        assert_eq!(
            load(&folder, "sb-test-auth-token").unwrap().as_deref(),
            Some("{\"a\":1}")
        );

        forget(&folder, "sb-test-auth-token").unwrap();

        assert_eq!(load(&folder, "sb-test-auth-token").unwrap(), None);
        assert!(store(&folder, "..\\escape", "x").is_err());
    }
}
