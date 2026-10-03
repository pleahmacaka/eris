use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::WebviewWindow;
use windows::core::HSTRING;
use windows::Win32::System::Environment::ExpandEnvironmentStringsW;
use windows::Win32::UI::Shell::{IShellItem, SIGDN_DESKTOPABSOLUTEPARSING, SIGDN_FILESYSPATH};

use crate::actions::shell_open;
use crate::error::{Error, Result};
use crate::{com, places};

#[derive(Serialize)]
pub struct Resolved {
    pub path: String,
    pub select: Option<String>,
    pub file: bool,
}

fn expand(input: &str) -> String {
    let source = HSTRING::from(input);
    let needed = unsafe { ExpandEnvironmentStringsW(&source, None) } as usize;

    if needed == 0 {
        return input.to_string();
    }

    let mut buffer = vec![0u16; needed];
    let written = unsafe { ExpandEnvironmentStringsW(&source, Some(&mut buffer)) } as usize;

    String::from_utf16_lossy(&buffer[..written.saturating_sub(1).min(buffer.len())])
}

pub fn describe(item: &IShellItem) -> Resolved {
    let system = com::display(item, SIGDN_FILESYSPATH);

    if !system.is_empty() {
        return local(PathBuf::from(system));
    }

    let parsed = com::display(item, SIGDN_DESKTOPABSOLUTEPARSING);
    let path = if com::pidl(&parsed).is_ok() {
        parsed
    } else {
        format!("shell:{parsed}")
    };

    if com::is_folder(item) {
        return Resolved {
            path,
            select: None,
            file: false,
        };
    }

    Resolved {
        path: String::new(),
        select: Some(path),
        file: true,
    }
}

fn local(path: PathBuf) -> Resolved {
    if path.is_dir() {
        return Resolved {
            path: path.to_string_lossy().to_string(),
            select: None,
            file: false,
        };
    }

    Resolved {
        path: path
            .parent()
            .map(|parent| parent.to_string_lossy().to_string())
            .unwrap_or_default(),
        select: Some(path.to_string_lossy().to_string()),
        file: true,
    }
}

fn linux_path(text: &str) -> Option<PathBuf> {
    let rest = text
        .strip_prefix('\\')
        .filter(|rest| !rest.starts_with('\\'))?;
    let mounted = rest
        .strip_prefix(r"mnt\")
        .map(|mount| mount.split_once('\\').unwrap_or((mount, "")))
        .filter(|(drive, _)| drive.len() == 1 && drive.chars().all(|c| c.is_ascii_alphabetic()));

    if let Some((drive, tail)) = mounted {
        return Some(PathBuf::from(format!(r"{drive}:\{tail}")));
    }

    let distro = places::default_distro()?;

    Some(PathBuf::from(format!(
        r"{}\{rest}",
        places::wsl_root(&distro)
    )))
}

pub fn resolve(input: &str, cwd: Option<&Path>) -> Result<Resolved> {
    let _apartment = com::Apartment::enter();
    let text = expand(input.trim().trim_matches('"')).replace('/', "\\");

    if text.is_empty() {
        return Err(Error::Missing);
    }

    if text.starts_with("::") || text.to_ascii_lowercase().starts_with("shell:") {
        return Ok(describe(&com::item(&text)?));
    }

    let joined = match cwd {
        Some(base) if Path::new(&text).is_relative() => base.join(&text),
        _ => PathBuf::from(&text),
    };

    let full = std::path::absolute(&joined)?;

    if full.exists() {
        return Ok(local(full));
    }

    if let Some(linux) = linux_path(&text).filter(|path| path.exists()) {
        return Ok(local(linux));
    }

    com::item(&text)
        .map(|item| describe(&item))
        .map_err(|_| Error::Missing)
}

fn is_url(text: &str) -> bool {
    let Some((scheme, _)) = text.split_once(':') else {
        return false;
    };

    scheme.len() > 1
        && !scheme.eq_ignore_ascii_case("shell")
        && scheme.starts_with(|c: char| c.is_ascii_alphabetic())
        && scheme
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '-' | '.'))
}

fn split_command(text: &str) -> (String, String) {
    let (program, rest) = match text.strip_prefix('"') {
        Some(quoted) => quoted.split_once('"').unwrap_or((quoted, "")),
        None => text.split_once(char::is_whitespace).unwrap_or((text, "")),
    };

    (program.to_string(), rest.trim().to_string())
}

fn run(owner: isize, input: &str, cwd: Option<&str>) -> Result<Option<Resolved>> {
    let text = expand(input.trim());

    if is_url(&text) {
        return shell_open(owner, &text, "", None)
            .then_some(None)
            .ok_or(Error::Missing);
    }

    if let Ok(found) = resolve(&text, cwd.map(Path::new)) {
        return Ok(Some(found));
    }

    let (program, mut parameters) = split_command(&text);

    if program.eq_ignore_ascii_case("wt") && parameters.is_empty() {
        if let Some(dir) = cwd {
            parameters = format!("-d \"{dir}\"");
        }
    }

    shell_open(owner, &program, &parameters, cwd)
        .then_some(None)
        .ok_or(Error::Missing)
}

#[tauri::command]
pub async fn run_address(
    window: WebviewWindow,
    input: String,
    cwd: Option<String>,
) -> Result<Option<Resolved>> {
    let owner = com::hwnd(&window);

    com::sta(move || run(owner, &input, cwd.as_deref())).await?
}
