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
pub struct Remote {
    name: String,
    url: String,
}

#[derive(Serialize)]
pub struct Head {
    branch: String,
    remotes: Vec<Remote>,
}

#[derive(Serialize, Deserialize)]
pub struct Repo {
    root: String,
    prefix: String,
    superproject: Option<String>,
    #[serde(skip_deserializing)]
    head: Option<Head>,
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
    parents: Vec<String>,
    refs: Vec<String>,
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

// Most folders are not repositories; spawning git just to learn that costs tens of milliseconds.
fn has_git_marker(path: &str) -> bool {
    Path::new(path)
        .ancestors()
        .any(|dir| dir.join(".git").exists())
}

fn remotes(config: &str) -> Vec<Remote> {
    let mut found = Vec::new();
    let mut section: Option<&str> = None;

    for line in config.lines().map(str::trim) {
        if line.starts_with('[') {
            section = line
                .strip_prefix("[remote \"")
                .and_then(|rest| rest.strip_suffix("\"]"));

            continue;
        }

        let (Some(name), Some((key, value))) = (section, line.split_once('=')) else {
            continue;
        };

        if key.trim() == "url" {
            found.push(Remote {
                name: name.to_string(),
                url: value.trim().to_string(),
            });
        }
    }

    found
}

// listings decorate every repository folder, so this reads .git from disk instead of spawning git
pub fn head_of(folder: &Path) -> Option<Head> {
    let marker = folder.join(".git");
    let gitdir = if marker.is_dir() {
        marker
    } else {
        let text = std::fs::read_to_string(&marker).ok()?;

        folder.join(text.trim().strip_prefix("gitdir:")?.trim())
    };
    let common = std::fs::read_to_string(gitdir.join("commondir"))
        .map(|dir| gitdir.join(dir.trim()))
        .unwrap_or_else(|_| gitdir.clone());
    let head = std::fs::read_to_string(gitdir.join("HEAD")).ok()?;
    let head = head.trim();
    let branch = match head.strip_prefix("ref:") {
        Some(reference) => reference
            .trim()
            .trim_start_matches("refs/heads/")
            .to_string(),
        None => head.chars().take(7).collect(),
    };
    let config = std::fs::read_to_string(common.join("config")).unwrap_or_default();

    Some(Head {
        branch,
        remotes: remotes(&config),
    })
}

fn repo(path: &str) -> Option<Repo> {
    if !has_git_marker(path) {
        return None;
    }

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
    let root = native(lines.next().filter(|root| !root.is_empty())?);

    Some(Repo {
        head: head_of(Path::new(&root)),
        root,
        prefix: lines.next().unwrap_or_default().to_string(),
        superproject: lines.next().filter(|line| !line.is_empty()).map(native),
    })
}

fn status(path: &str, whole: bool, repo: Repo) -> Result<Status> {
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

    Ok(Status {
        repo: Repo {
            head: head_of(Path::new(&repo.root)),
            ..repo
        },
        branch: branch.to_string(),
        upstream,
        ahead: count(counts, "ahead "),
        behind: count(counts, "behind "),
        changes,
    })
}

fn log(root: &str) -> Vec<Commit> {
    let format = "--format=%h%x1f%p%x1f%D%x1f%s%x1f%an%x1f%ct";
    let args = [
        "log",
        "--topo-order",
        "-n",
        "50",
        format,
        "--branches",
        "--remotes",
        "HEAD",
    ];
    let text = run(root, args).unwrap_or_default();

    text.lines()
        .filter_map(|line| {
            let mut parts = line.split('\x1f');

            Some(Commit {
                hash: parts.next()?.to_string(),
                parents: parts.next()?.split_whitespace().map(String::from).collect(),
                refs: parts
                    .next()?
                    .split(", ")
                    .filter(|name| !name.is_empty() && *name != "HEAD" && !name.ends_with("/HEAD"))
                    .map(|name| {
                        name.trim_start_matches("HEAD -> ")
                            .trim_start_matches("tag: ")
                            .to_string()
                    })
                    .collect(),
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
pub async fn git_status(path: String, whole: bool, repo: Repo) -> Result<Status> {
    blocking(move || status(&path, whole, repo)).await
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
