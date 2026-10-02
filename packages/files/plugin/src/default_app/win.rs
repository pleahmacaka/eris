use std::io;

use windows::Win32::UI::Shell::{SHChangeNotify, SHCNE_ASSOCCHANGED, SHCNF_IDLIST};
use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE};
use winreg::RegKey;

use super::registry::Registry;

pub struct WinRegistry {
    root: RegKey,
}

impl WinRegistry {
    pub fn current_user() -> Self {
        Self {
            root: RegKey::predef(HKEY_CURRENT_USER),
        }
    }
}

fn missing(err: &io::Error) -> bool {
    err.kind() == io::ErrorKind::NotFound
}

impl Registry for WinRegistry {
    fn read(&self, key: &str, value: &str) -> Option<String> {
        self.root
            .open_subkey(key)
            .ok()?
            .get_value::<String, _>(value)
            .ok()
    }

    fn write(&mut self, key: &str, value: &str, data: &str) -> io::Result<()> {
        let (subkey, _) = self.root.create_subkey(key)?;
        subkey.set_value(value, &data.to_string())
    }

    fn delete_value(&mut self, key: &str, value: &str) -> io::Result<()> {
        let subkey = match self.root.open_subkey_with_flags(key, KEY_SET_VALUE) {
            Ok(subkey) => subkey,
            Err(err) if missing(&err) => return Ok(()),
            Err(err) => return Err(err),
        };

        match subkey.delete_value(value) {
            Err(err) if missing(&err) => Ok(()),
            other => other,
        }
    }

    fn delete_tree(&mut self, key: &str) -> io::Result<()> {
        match self.root.delete_subkey_all(key) {
            Err(err) if missing(&err) => Ok(()),
            other => other,
        }
    }

    fn key_is_empty(&self, key: &str) -> bool {
        match self.root.open_subkey_with_flags(key, KEY_READ) {
            Ok(subkey) => subkey
                .query_info()
                .map(|info| info.sub_keys == 0 && info.values == 0)
                .unwrap_or(false),
            Err(_) => false,
        }
    }
}

pub fn associations_changed() {
    unsafe { SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, None, None) };
}

pub fn open_default_apps(app: &str) -> bool {
    let _apartment = crate::com::Apartment::enter();
    let name = percent_encoding::utf8_percent_encode(app, percent_encoding::NON_ALPHANUMERIC);

    crate::actions::shell_open(
        0,
        &format!("ms-settings:defaultapps?registeredAppUser={name}"),
        "",
        None,
    )
}
