use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::actions::execute;
use crate::error::{Error, Result};

#[derive(Serialize)]
pub struct Resolved {
    pub path: String,
    pub select: Option<String>,
    pub file: bool,
}

fn local(path: PathBuf) -> Resolved {
    if path.is_dir() {
        return Resolved {
            path: path.to_string_lossy().into_owned(),
            select: None,
            file: false,
        };
    }

    Resolved {
        path: path
            .parent()
            .map(|parent| parent.to_string_lossy().into_owned())
            .unwrap_or_default(),
        select: Some(path.to_string_lossy().into_owned()),
        file: true,
    }
}

fn expand(text: &str) -> PathBuf {
    let home = std::env::var_os("HOME").map(PathBuf::from);

    match (text.strip_prefix('~'), home) {
        (Some(rest), Some(home)) if rest.is_empty() || rest.starts_with('/') => {
            home.join(rest.trim_start_matches('/'))
        }
        _ => PathBuf::from(text),
    }
}

pub fn resolve(input: &str, cwd: Option<&Path>) -> Result<Resolved> {
    let text = input.trim().trim_matches('"');

    if text.is_empty() {
        return Err(Error::Missing);
    }

    if text.starts_with("::") {
        return Ok(Resolved {
            path: text.to_string(),
            select: None,
            file: false,
        });
    }

    let path = expand(text);
    let path = match cwd {
        Some(cwd) if path.is_relative() => cwd.join(path),
        _ => path,
    };

    if !path.exists() {
        return Err(Error::Missing);
    }

    Ok(local(path))
}

fn is_url(text: &str) -> bool {
    text.split_once("://").is_some_and(|(scheme, _)| {
        !scheme.is_empty() && scheme.chars().all(|c| c.is_ascii_alphanumeric())
    })
}

#[tauri::command]
pub async fn run_address(input: String, cwd: Option<String>) -> Result<Option<Resolved>> {
    let text = input.trim();

    if is_url(text) {
        return execute(0, text).map(|_| None);
    }

    if let Ok(found) = resolve(text, cwd.as_deref().map(Path::new)) {
        return Ok(Some(found));
    }

    let mut words = text.split_whitespace();
    let program = words.next().ok_or(Error::Missing)?;
    let mut command = std::process::Command::new(program);

    command.args(words);

    if let Some(dir) = cwd.filter(|dir| Path::new(dir).is_dir()) {
        command.current_dir(dir);
    }

    command.spawn().map(|_| None).map_err(|_| Error::Missing)
}
