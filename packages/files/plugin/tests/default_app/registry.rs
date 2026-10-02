use std::collections::BTreeMap;
use std::io;
use std::path::{Path, PathBuf};

use tauri_plugin_eris_files::default_app::{
    disable_with, enable_with, status_with, DefaultState, Registry,
};
use tauri_plugin_eris_files::STANDALONE;

#[derive(Clone, Default, PartialEq, Eq, Debug)]
struct Mem {
    keys: BTreeMap<String, BTreeMap<String, String>>,
}

impl Mem {
    fn norm(key: &str) -> String {
        key.to_ascii_lowercase()
    }

    fn ensure(&mut self, key: &str) {
        let parts: Vec<&str> = key.split('\\').collect();

        for end in 1..=parts.len() {
            let path = parts[..end].join("\\");
            self.keys.entry(Self::norm(&path)).or_default();
        }
    }
}

impl Registry for Mem {
    fn read(&self, key: &str, value: &str) -> Option<String> {
        self.keys
            .get(&Self::norm(key))?
            .get(&value.to_ascii_lowercase())
            .cloned()
    }

    fn write(&mut self, key: &str, value: &str, data: &str) -> io::Result<()> {
        self.ensure(key);
        self.keys
            .get_mut(&Self::norm(key))
            .unwrap()
            .insert(value.to_ascii_lowercase(), data.to_string());

        Ok(())
    }

    fn delete_value(&mut self, key: &str, value: &str) -> io::Result<()> {
        if let Some(values) = self.keys.get_mut(&Self::norm(key)) {
            values.remove(&value.to_ascii_lowercase());
        }

        Ok(())
    }

    fn delete_tree(&mut self, key: &str) -> io::Result<()> {
        let root = Self::norm(key);
        let prefix = format!("{root}\\");
        self.keys
            .retain(|k, _| k != &root && !k.starts_with(&prefix));

        Ok(())
    }

    fn key_is_empty(&self, key: &str) -> bool {
        let root = Self::norm(key);
        let prefix = format!("{root}\\");

        match self.keys.get(&root) {
            Some(values) => values.is_empty() && !self.keys.keys().any(|k| k.starts_with(&prefix)),
            None => false,
        }
    }
}

fn exe() -> PathBuf {
    PathBuf::from(r"C:\Users\x\AppData\Local\eris\eris-files.exe")
}

// HKCU\Software\Classes always exists on a real user hive; seed it so the
// round-trip baseline matches what enable/disable can actually leave behind.
fn seeded() -> Mem {
    let mut reg = Mem::default();
    reg.ensure(r"Software\Classes");

    reg
}

#[test]
fn clean_enable_disable_restores_empty_registry() {
    let mut reg = seeded();
    let before = reg.clone();

    assert_eq!(status_with(&reg, &exe()), DefaultState::Disabled);

    enable_with(&mut reg, &STANDALONE, &exe()).unwrap();
    assert_eq!(status_with(&reg, &exe()), DefaultState::Enabled);

    let cmd = reg
        .read(r"Software\Classes\Folder\shell\open\command", "")
        .unwrap();
    assert!(cmd.contains("eris-files.exe"));
    assert_eq!(
        reg.read(
            r"Software\Classes\Folder\shell\open\command",
            "DelegateExecute"
        ),
        Some(String::new())
    );

    disable_with(&mut reg).unwrap();
    assert_eq!(status_with(&reg, &exe()), DefaultState::Disabled);
    assert_eq!(reg, before);
}

#[test]
fn disable_restores_pre_existing_values_and_keeps_siblings() {
    let mut reg = seeded();

    reg.write(
        r"Software\Classes\Directory\shell\open\command",
        "",
        r"C:\Windows\explorer.exe /custom",
    )
    .unwrap();
    reg.write(
        r"Software\Classes\Folder\shellex\ContextMenuHandlers\Keep",
        "",
        "{some-handler}",
    )
    .unwrap();

    let before = reg.clone();

    enable_with(&mut reg, &STANDALONE, &exe()).unwrap();
    assert_eq!(
        reg.read(r"Software\Classes\Directory\shell\open\command", ""),
        Some(format!("\"{}\" \"%1\"", exe().display()))
    );

    disable_with(&mut reg).unwrap();

    assert_eq!(reg, before);
    assert_eq!(
        reg.read(
            r"Software\Classes\Folder\shellex\ContextMenuHandlers\Keep",
            ""
        ),
        Some("{some-handler}".to_string())
    );
}

#[test]
fn status_reports_other_exe_when_binary_moved() {
    let mut reg = Mem::default();
    enable_with(&mut reg, &STANDALONE, Path::new(r"C:\old\eris-files.exe")).unwrap();

    assert_eq!(
        status_with(&reg, &exe()),
        DefaultState::EnabledForOtherExe(PathBuf::from(r"C:\old\eris-files.exe"))
    );
}

#[test]
fn repoint_updates_binding_without_losing_backup() {
    let mut reg = seeded();
    let before = reg.clone();

    enable_with(&mut reg, &STANDALONE, Path::new(r"C:\old\eris-files.exe")).unwrap();
    enable_with(&mut reg, &STANDALONE, &exe()).unwrap();

    assert_eq!(status_with(&reg, &exe()), DefaultState::Enabled);
    assert_eq!(
        reg.read(r"Software\Classes\Folder\shell\open\command", ""),
        Some(format!("\"{}\" \"%1\"", exe().display()))
    );

    disable_with(&mut reg).unwrap();
    assert_eq!(reg, before);
}

#[test]
fn status_reports_conflict_from_foreign_override() {
    let mut reg = Mem::default();
    reg.write(
        r"Software\Classes\Folder\shell\open\command",
        "",
        r"C:\other\fm.exe",
    )
    .unwrap();

    assert_eq!(
        status_with(&reg, &exe()),
        DefaultState::Conflict(r"C:\other\fm.exe".to_string())
    );
}

#[test]
fn disable_without_enable_is_noop() {
    let mut reg = Mem::default();
    disable_with(&mut reg).unwrap();
    assert_eq!(reg, Mem::default());
}
