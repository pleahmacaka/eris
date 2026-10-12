use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::apps::{App, VERSION};
use crate::fail;

pub const MANIFEST_KEY: &str = "eris-installer-linux-x86_64";

const VERSION_KEY: &str = "X-Eris-Version=";

fn data() -> PathBuf {
    std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share")))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn identifier(app: &App) -> String {
    format!("com.arixlab.eris.{}", app.id)
}

fn entry(app: &App) -> PathBuf {
    data()
        .join("applications")
        .join(format!("{}.desktop", identifier(app)))
}

fn icon(app: &App) -> &'static [u8] {
    match app.id {
        "terminal" => include_bytes!("../../../../packages/terminal/plugin/icons/128x128.png"),
        _ => include_bytes!("../../../../packages/files/plugin/icons/128x128.png"),
    }
}

fn categories(app: &App) -> &'static str {
    match app.id {
        "terminal" => "System;TerminalEmulator;",
        _ => "System;FileManager;",
    }
}

pub fn installed(app: &App) -> Option<String> {
    std::fs::read_to_string(entry(app))
        .ok()?
        .lines()
        .find_map(|line| line.strip_prefix(VERSION_KEY))
        .map(str::to_string)
}

fn write(path: &Path, bytes: &[u8], mode: u32) -> Result<(), String> {
    let staged = path.with_extension("new");

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(fail)?;
    }

    std::fs::write(&staged, bytes).map_err(fail)?;
    std::fs::set_permissions(&staged, std::fs::Permissions::from_mode(mode)).map_err(fail)?;

    // renaming over a running AppImage works where writing into it fails with ETXTBSY
    std::fs::rename(&staged, path).map_err(fail)
}

pub fn install(app: &App, payload: &[u8]) -> Result<(), String> {
    let image = data()
        .join("eris")
        .join(format!("eris-{}.AppImage", app.id));
    let icon_path = data()
        .join("icons/hicolor/128x128/apps")
        .join(format!("{}.png", identifier(app)));

    write(&image, payload, 0o755)?;
    write(&icon_path, icon(app), 0o644)?;

    let desktop = format!(
        "[Desktop Entry]\nType=Application\nName={}\nExec=\"{}\" %U\nIcon={}\nCategories={}\nTerminal=false\n{VERSION_KEY}{VERSION}\n",
        app.product,
        image.display(),
        identifier(app),
        categories(app),
    );

    write(&entry(app), desktop.as_bytes(), 0o644)
}

pub fn launch_installer(bytes: &[u8], version: &str) -> Result<(), String> {
    let path = std::env::var_os("APPIMAGE")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join(format!("Eris_{version}_installer.AppImage")));

    write(&path, bytes, 0o755)?;
    Command::new(path).spawn().map_err(fail)?;

    Ok(())
}
