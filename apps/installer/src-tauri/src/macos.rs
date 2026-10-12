use std::path::{Path, PathBuf};
use std::process::Command;

use flate2::read::GzDecoder;

use crate::apps::App;
use crate::fail;

pub const MANIFEST_KEY: &str = "eris-installer-darwin-aarch64";

fn home() -> Option<PathBuf> {
    std::env::var_os("HOME").map(PathBuf::from)
}

fn roots() -> Vec<PathBuf> {
    let mut roots = vec![PathBuf::from("/Applications")];

    roots.extend(home().map(|home| home.join("Applications")));

    roots
}

fn bundle(root: &Path, app: &App) -> PathBuf {
    root.join(format!("{}.app", app.product))
}

pub fn installed(app: &App) -> Option<String> {
    roots().iter().find_map(|root| {
        let info = bundle(root, app).join("Contents").join("Info.plist");
        let value = plist::Value::from_file(info).ok()?;

        value
            .as_dictionary()?
            .get("CFBundleShortVersionString")?
            .as_string()
            .map(str::to_string)
    })
}

fn writable(root: &Path) -> bool {
    let probe = root.join(".eris-installer-probe");

    std::fs::create_dir_all(root).is_ok()
        && std::fs::write(&probe, b"").is_ok()
        && std::fs::remove_file(&probe).is_ok()
}

fn target_root(app: &App) -> Result<PathBuf, String> {
    let roots = roots();

    match roots.iter().find(|root| bundle(root, app).exists()) {
        Some(root) if writable(root) => Ok(root.clone()),
        Some(root) => Err(format!("{} is not writable", root.display())),
        None => roots
            .into_iter()
            .find(|root| writable(root))
            .ok_or_else(|| "no writable Applications folder".to_string()),
    }
}

pub fn install(app: &App, payload: &[u8]) -> Result<(), String> {
    let root = target_root(app)?;
    let staging = tempfile::Builder::new()
        .prefix(".eris-installer-")
        .tempdir_in(&root)
        .map_err(fail)?;

    tar::Archive::new(GzDecoder::new(payload))
        .unpack(staging.path())
        .map_err(fail)?;

    let fresh = bundle(staging.path(), app);
    let target = bundle(&root, app);
    let previous = staging.path().join("previous.app");

    if target.exists() {
        std::fs::rename(&target, &previous).map_err(fail)?;
    }

    std::fs::rename(&fresh, &target).map_err(|error| {
        if previous.exists() {
            let _ = std::fs::rename(&previous, &target);
        }

        fail(error)
    })
}

pub fn launch_installer(bytes: &[u8], version: &str) -> Result<(), String> {
    let path = home()
        .ok_or("no home folder")?
        .join("Downloads")
        .join(format!("Eris_{version}_installer.dmg"));

    std::fs::write(&path, bytes).map_err(fail)?;
    Command::new("open").arg(path).spawn().map_err(fail)?;

    Ok(())
}
