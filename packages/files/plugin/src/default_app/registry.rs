use std::io;
use std::path::{Path, PathBuf};

use crate::Host;

pub type Result<T> = io::Result<T>;

const CLASSES: &str = r"Software\Classes";
const MARKER: &str = r"Software\Eris\ExplorerDefault";
const MARKER_PARENT: &str = r"Software\Eris";
const WIN_E_CLSID: &str = "{52205fd8-5dfb-447d-801a-d0b52f2e83e1}";

pub const MODEL_TYPES: [&str; 1] = ["obj"];
const REGISTERED: &str = r"Software\RegisteredApplications";
const VENDOR: &str = r"Software\ArixLab";
const DESCRIPTION: &str = "File explorer for the Eris desktop shell";
const MODEL_TYPE_NAME: &str = "3D Object";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DefaultState {
    Disabled,
    Enabled,
    EnabledForOtherExe(PathBuf),
    Conflict(String),
}

pub trait Registry {
    fn read(&self, key: &str, value: &str) -> Option<String>;

    fn write(&mut self, key: &str, value: &str, data: &str) -> Result<()>;

    fn delete_value(&mut self, key: &str, value: &str) -> Result<()>;

    fn delete_tree(&mut self, key: &str) -> Result<()>;

    fn key_is_empty(&self, key: &str) -> bool;
}

struct Binding {
    key: String,
    command: String,
}

fn launcher(host: &Host, exe: &Path) -> String {
    match host.marker {
        Some(marker) => format!("\"{}\" {marker}", exe.display()),
        None => format!("\"{}\"", exe.display()),
    }
}

fn opener(host: &Host, exe: &Path) -> String {
    format!("{} \"%1\"", launcher(host, exe))
}

fn bindings(host: &Host, exe: &Path) -> Vec<Binding> {
    let with_path = opener(host, exe);
    let bare = launcher(host, exe);

    vec![
        Binding {
            key: key(r"Folder\shell\open\command"),
            command: with_path.clone(),
        },
        Binding {
            key: key(r"Folder\shell\explore\command"),
            command: with_path.clone(),
        },
        Binding {
            key: key(r"Directory\shell\open\command"),
            command: with_path.clone(),
        },
        Binding {
            key: key(r"Drive\shell\open\command"),
            command: with_path,
        },
        Binding {
            key: format!(r"{CLASSES}\CLSID\{WIN_E_CLSID}\shell\opennewwindow\command"),
            command: bare,
        },
    ]
}

fn key(suffix: &str) -> String {
    format!(r"{CLASSES}\{suffix}")
}

pub fn status_with<R: Registry>(reg: &R, exe: &Path) -> DefaultState {
    match reg.read(MARKER, "Exe") {
        Some(stored) => {
            if same_path(&stored, exe) {
                DefaultState::Enabled
            } else {
                DefaultState::EnabledForOtherExe(PathBuf::from(stored))
            }
        }
        None => match reg.read(&key(r"Folder\shell\open\command"), "") {
            Some(cmd) => DefaultState::Conflict(cmd),
            None => DefaultState::Disabled,
        },
    }
}

pub fn enable_with<R: Registry>(reg: &mut R, host: &Host, exe: &Path) -> Result<()> {
    let bindings = bindings(host, exe);

    if reg.read(MARKER, "Backup").is_none() {
        let backup = snapshot(reg, &bindings);
        reg.write(MARKER, "Backup", &backup)?;
    }

    for b in &bindings {
        reg.write(&b.key, "", &b.command)?;
        // an inherited DelegateExecute routes the verb to Explorer's COM handler and ignores our command
        reg.write(&b.key, "DelegateExecute", "")?;
    }

    reg.write(MARKER, "Exe", &exe.display().to_string())?;

    Ok(())
}

pub fn disable_with<R: Registry>(reg: &mut R) -> Result<()> {
    let Some(backup) = reg.read(MARKER, "Backup") else {
        return Ok(());
    };

    for entry in parse_backup(&backup) {
        match entry.prior {
            Some(data) => reg.write(&entry.key, &entry.value, &data)?,
            None => reg.delete_value(&entry.key, &entry.value)?,
        }
    }

    prune(reg)?;
    reg.delete_tree(MARKER)?;

    if reg.key_is_empty(MARKER_PARENT) {
        reg.delete_tree(MARKER_PARENT)?;
    }

    Ok(())
}

struct Snapshot {
    key: String,
    value: String,
    prior: Option<String>,
}

fn snapshot<R: Registry>(reg: &R, bindings: &[Binding]) -> String {
    let mut lines = Vec::new();

    for b in bindings {
        for value in ["", "DelegateExecute"] {
            let prior = reg.read(&b.key, value);
            let exists = if prior.is_some() { "1" } else { "0" };
            let data = prior.unwrap_or_default();
            lines.push(format!("{exists}\t{}\t{value}\t{data}", b.key));
        }
    }

    lines.join("\n")
}

fn parse_backup(backup: &str) -> Vec<Snapshot> {
    backup
        .split('\n')
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let mut fields = line.splitn(4, '\t');
            let exists = fields.next()?;
            let key = fields.next()?.to_string();
            let value = fields.next()?.to_string();
            let data = fields.next().unwrap_or("").to_string();
            let prior = (exists == "1").then_some(data);

            Some(Snapshot { key, value, prior })
        })
        .collect()
}

fn prune<R: Registry>(reg: &mut R) -> Result<()> {
    let mut keys: Vec<String> = Vec::new();

    for b in bindings(&crate::STANDALONE, Path::new("")) {
        let mut current = b.key.as_str();

        loop {
            keys.push(current.to_string());

            match current.rsplit_once('\\') {
                Some((parent, _)) if !parent.eq_ignore_ascii_case(CLASSES) => current = parent,
                _ => break,
            }
        }
    }

    keys.sort();
    keys.dedup();
    keys.reverse();

    for k in keys {
        if reg.key_is_empty(&k) {
            reg.delete_tree(&k)?;
        }
    }

    Ok(())
}

fn prog_id(host: &Host, extension: &str) -> String {
    format!("{}.{extension}", host.prog_prefix)
}

fn app_key(host: &Host) -> String {
    format!(r"{VENDOR}\{}", host.app_name)
}

fn capabilities(host: &Host) -> String {
    format!(r"{}\Capabilities", app_key(host))
}

pub fn registered_with<R: Registry>(reg: &R, host: &Host, exe: &Path) -> bool {
    reg.read(REGISTERED, host.app_name).is_some()
        && MODEL_TYPES.iter().all(|extension| {
            let command = key(&format!(r"{}\shell\open\command", prog_id(host, extension)));

            reg.read(&command, "").as_deref() == Some(opener(host, exe).as_str())
        })
}

pub fn register_with<R: Registry>(reg: &mut R, host: &Host, exe: &Path) -> Result<()> {
    let icon = format!("\"{}\",0", exe.display());
    let capabilities = capabilities(host);

    reg.write(&capabilities, "ApplicationName", host.app_name)?;
    reg.write(&capabilities, "ApplicationDescription", DESCRIPTION)?;
    reg.write(&capabilities, "ApplicationIcon", &icon)?;

    for extension in MODEL_TYPES {
        let id = prog_id(host, extension);

        reg.write(
            &format!(r"{capabilities}\FileAssociations"),
            &format!(".{extension}"),
            &id,
        )?;
        reg.write(&key(&id), "", MODEL_TYPE_NAME)?;
        reg.write(&key(&format!(r"{id}\DefaultIcon")), "", &icon)?;
        reg.write(
            &key(&format!(r"{id}\shell\open\command")),
            "",
            &opener(host, exe),
        )?;
        reg.write(&key(&format!(r".{extension}\OpenWithProgids")), &id, "")?;
    }

    reg.write(REGISTERED, host.app_name, &capabilities)
}

pub fn unregister_with<R: Registry>(reg: &mut R, host: &Host) -> Result<()> {
    reg.delete_value(REGISTERED, host.app_name)?;
    reg.delete_tree(&app_key(host))?;

    if reg.key_is_empty(VENDOR) {
        reg.delete_tree(VENDOR)?;
    }

    for extension in MODEL_TYPES {
        let id = prog_id(host, extension);
        let with = key(&format!(r".{extension}\OpenWithProgids"));

        reg.delete_tree(&key(&id))?;
        reg.delete_value(&with, &id)?;

        for leftover in [with, key(&format!(".{extension}"))] {
            if reg.key_is_empty(&leftover) {
                reg.delete_tree(&leftover)?;
            }
        }
    }

    Ok(())
}

fn same_path(a: &str, b: &Path) -> bool {
    a.eq_ignore_ascii_case(&b.display().to_string())
}
