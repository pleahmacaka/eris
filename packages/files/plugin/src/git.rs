use std::ffi::OsStr;
use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

#[derive(Serialize)]
pub struct Change {
    code: String,
    path: String,
}

#[derive(Serialize)]
pub struct Repo {
    root: String,
    prefix: String,
    superproject: Option<String>,
}

#[derive(Serialize)]
pub struct Status {
    #[serde(flatten)]
    repo: Repo,
    branch: String,
    upstream: Option<String>,
    ahead: u32,
    behind: u32,
    changes: Vec<Change>,
}

#[derive(Serialize)]
pub struct Commit {
    hash: String,
    subject: String,
    author: String,
    time: u64,
}

#[derive(Deserialize, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Sync {
    Fetch,
    Pull,
    Push,
}

impl Sync {
    fn verb(self) -> &'static str {
        match self {
            Sync::Fetch => "fetch",
            Sync::Pull => "pull",
            Sync::Push => "push",
        }
    }
}

fn git(cwd: &str) -> Command {
    let mut command = Command::new("git");

    // a repository's own config could otherwise make a plain read run its fsmonitor program
    command
        .args(["--no-optional-locks", "--literal-pathspecs"])
        .args(["-c", "core.fsmonitor=false", "-C"])
        .arg(cwd)
        .env("GIT_TERMINAL_PROMPT", "0");

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        // CREATE_NO_WINDOW: a GUI parent otherwise flashes a console for every call
        command.creation_flags(0x0800_0000);
    }

    command
}

fn run<S: AsRef<OsStr>>(cwd: &str, args: impl IntoIterator<Item = S>) -> Result<String> {
    let output = git(cwd).args(args).output()?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(Error::Os(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ))
    }
}

fn native(path: &str) -> String {
    if cfg!(windows) {
        path.replace('/', "\\")
    } else {
        path.to_string()
    }
}

fn count(counts: &str, label: &str) -> u32 {
    counts
        .trim_matches(['[', ']'])
        .split(", ")
        .find_map(|part| part.strip_prefix(label)?.parse().ok())
        .unwrap_or(0)
}

fn repo(path: &str) -> Option<Repo> {
    let text = run(
        path,
        [
            "rev-parse",
            "--show-toplevel",
            "--show-prefix",
            "--show-superproject-working-tree",
        ],
    )
    .ok()?;
    let mut lines = text.lines().map(str::trim);

    Some(Repo {
        root: native(lines.next().filter(|root| !root.is_empty())?),
        prefix: lines.next().unwrap_or_default().to_string(),
        superproject: lines.next().filter(|line| !line.is_empty()).map(native),
    })
}

fn status(path: &str, whole: bool) -> Result<Option<Status>> {
    let Some(repo) = repo(path) else {
        return Ok(None);
    };

    let mut args = vec![
        "status",
        "--porcelain=v1",
        "-z",
        "--branch",
        "--ignored=matching",
        "--untracked-files=normal",
    ];

    if !whole {
        args.extend(["--", "."]);
    }

    let text = run(path, args)?;

    let mut fields = text.split('\0');
    let header = fields.next().unwrap_or_default().trim_start_matches("## ");
    let header = header.strip_prefix("No commits yet on ").unwrap_or(header);
    let (names, counts) = header.split_once(" [").unwrap_or((header, ""));
    let (branch, upstream) = match names.split_once("...") {
        Some((branch, upstream)) => (branch, Some(upstream.to_string())),
        None => (names, None),
    };

    let mut changes = Vec::new();

    while let Some(field) = fields.next() {
        if field.len() < 4 {
            continue;
        }

        let code = &field[..2];

        if code.starts_with(['R', 'C']) {
            fields.next();
        }

        changes.push(Change {
            code: code.to_string(),
            path: field[3..].to_string(),
        });
    }

    Ok(Some(Status {
        repo,
        branch: branch.to_string(),
        upstream,
        ahead: count(counts, "ahead "),
        behind: count(counts, "behind "),
        changes,
    }))
}

fn log(root: &str) -> Vec<Commit> {
    let format = "--format=%h%x1f%s%x1f%an%x1f%ct";
    let text = run(root, ["log", "-n", "30", format]).unwrap_or_default();

    text.lines()
        .filter_map(|line| {
            let mut parts = line.split('\x1f');

            Some(Commit {
                hash: parts.next()?.to_string(),
                subject: parts.next()?.to_string(),
                author: parts.next()?.to_string(),
                time: parts.next()?.parse::<u64>().ok()? * 1000,
            })
        })
        .collect()
}

fn clone(parent: &str, url: &str, name: &str, flags: Vec<String>) -> Result<String> {
    let plain = !name.is_empty() && name != "." && name != ".." && !name.contains(['/', '\\', ':']);

    if !plain {
        return Err(Error::Invalid);
    }

    let target = Path::new(parent).join(name);

    if target.exists() {
        return Err(Error::Os(format!("{name} already exists")));
    }

    let target = target.to_string_lossy().into_owned();

    run(
        parent,
        ["clone"]
            .into_iter()
            .chain(flags.iter().map(String::as_str))
            .chain(["--", url, &target]),
    )?;

    Ok(target)
}

fn with_paths<'a>(head: &'a [&'a str], paths: &'a [String]) -> impl Iterator<Item = &'a str> {
    head.iter()
        .copied()
        .chain(["--"])
        .chain(paths.iter().map(String::as_str))
}

async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T> + Send + 'static,
) -> Result<T> {
    tauri::async_runtime::spawn_blocking(work).await?
}

#[tauri::command]
pub async fn git_repo(path: String) -> Result<Option<Repo>> {
    blocking(move || Ok(repo(&path))).await
}

#[tauri::command]
pub async fn git_status(path: String, whole: bool) -> Result<Option<Status>> {
    blocking(move || status(&path, whole)).await
}

#[tauri::command]
pub async fn git_log(root: String) -> Result<Vec<Commit>> {
    blocking(move || Ok(log(&root))).await
}

#[tauri::command]
pub async fn git_stage(root: String, paths: Vec<String>) -> Result<()> {
    blocking(move || run(&root, with_paths(&["add"], &paths)).map(drop)).await
}

#[tauri::command]
pub async fn git_unstage(root: String, paths: Vec<String>) -> Result<()> {
    blocking(move || run(&root, with_paths(&["restore", "--staged"], &paths)).map(drop)).await
}

#[tauri::command]
pub async fn git_commit(root: String, message: String) -> Result<()> {
    blocking(move || run(&root, ["commit", "-m", &message]).map(drop)).await
}

#[tauri::command]
pub async fn git_sync(root: String, action: Sync) -> Result<()> {
    blocking(move || run(&root, [action.verb()]).map(drop)).await
}

#[tauri::command]
pub async fn git_clone(
    parent: String,
    url: String,
    name: String,
    flags: Vec<String>,
) -> Result<String> {
    blocking(move || clone(&parent, &url, &name, flags)).await
}
