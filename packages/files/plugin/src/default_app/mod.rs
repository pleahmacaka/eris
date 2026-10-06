mod registry;
#[cfg(windows)]
mod win;

#[cfg(windows)]
use std::path::PathBuf;

use serde::Serialize;
use tauri::State;

use crate::error::{Error, Result};
use crate::Host;

pub use registry::{
    disable_with, enable_with, register_with, registered_with, status_with, unregister_with,
    DefaultState, Registry, MODEL_TYPES,
};

#[derive(Serialize)]
pub struct DefaultApp {
    supported: bool,
    enabled: bool,
}

#[cfg(windows)]
fn exe() -> Result<PathBuf> {
    Ok(std::env::current_exe()?)
}

#[cfg(windows)]
fn report() -> DefaultApp {
    let enabled = exe()
        .map(|exe| status_with(&win::WinRegistry::current_user(), &exe) == DefaultState::Enabled)
        .unwrap_or(false);

    DefaultApp {
        supported: true,
        enabled,
    }
}

#[cfg(not(windows))]
fn report() -> DefaultApp {
    DefaultApp {
        supported: false,
        enabled: false,
    }
}

#[cfg(windows)]
fn register(
    registry: &mut win::WinRegistry,
    host: &Host,
    exe: &std::path::Path,
) -> std::io::Result<()> {
    if registered_with(registry, host, exe) {
        return Ok(());
    }

    register_with(registry, host, exe)?;
    win::associations_changed();

    Ok(())
}

pub fn enabled() -> bool {
    report().enabled
}

#[tauri::command]
pub fn default_app_status() -> DefaultApp {
    report()
}

#[cfg(windows)]
#[tauri::command]
pub fn set_default_app(host: State<'_, Host>, enabled: bool) -> Result<DefaultApp> {
    let exe = exe()?;
    let mut registry = win::WinRegistry::current_user();

    if enabled {
        register(&mut registry, &host, &exe)?;
        enable_with(&mut registry, &host, &exe)?;
    } else {
        disable_with(&mut registry)?;
    }

    Ok(report())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn set_default_app(_host: State<'_, Host>, _enabled: bool) -> Result<DefaultApp> {
    Err(Error::Unsupported)
}

#[cfg(windows)]
fn open_settings(host: &Host) -> Result<()> {
    let exe = exe()?;

    register(&mut win::WinRegistry::current_user(), host, &exe)?;

    win::open_default_apps(host.app_name)
        .then_some(())
        .ok_or(Error::Unsupported)
}

#[cfg(windows)]
#[tauri::command(async)]
pub fn open_default_apps(host: State<'_, Host>) -> Result<()> {
    open_settings(&host)
}

#[cfg(not(windows))]
#[tauri::command(async)]
pub fn open_default_apps(_host: State<'_, Host>) -> Result<()> {
    Err(Error::Unsupported)
}

#[cfg(windows)]
pub fn repoint(host: &Host) {
    let Ok(exe) = exe() else {
        return;
    };
    let mut registry = win::WinRegistry::current_user();

    let _ = register(&mut registry, host, &exe);

    // only follow our own host after a reinstall; the standalone app and Eris must not steal from each other
    if let DefaultState::EnabledForOtherExe(other) = status_with(&registry, &exe) {
        if other.file_name() == exe.file_name() {
            let _ = enable_with(&mut registry, host, &exe);
        }
    }
}

#[cfg(not(windows))]
pub fn repoint(_host: &Host) {}

#[cfg(windows)]
pub fn cli(host: &Host, args: &[String]) -> Option<i32> {
    let [flag, action] = args else {
        return None;
    };

    if flag != "--default-app" {
        return None;
    }

    let exe = exe().ok()?;
    let mut registry = win::WinRegistry::current_user();
    let applied = match action.as_str() {
        "on" => register(&mut registry, host, &exe)
            .and_then(|_| enable_with(&mut registry, host, &exe))
            .map_err(Error::from),
        "off" => disable_with(&mut registry).map_err(Error::from),
        "register" => register(&mut registry, host, &exe).map_err(Error::from),
        "unregister" => disable_with(&mut registry)
            .and_then(|_| unregister_with(&mut registry, host))
            .map(|_| win::associations_changed())
            .map_err(Error::from),
        "settings" => open_settings(host),
        "status" => Ok(()),
        _ => return Some(2),
    };

    let state = match status_with(&registry, &exe) {
        DefaultState::Enabled => "enabled",
        DefaultState::Disabled => "disabled",
        DefaultState::EnabledForOtherExe(_) => "other",
        DefaultState::Conflict(_) => "conflict",
    };

    println!("{state}");

    Some(if applied.is_ok() { 0 } else { 1 })
}

#[cfg(not(windows))]
pub fn cli(_host: &Host, _args: &[String]) -> Option<i32> {
    None
}
