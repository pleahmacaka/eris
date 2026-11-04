use std::collections::HashMap;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::pty::Sessions;

const FIRST_READ_LIMIT: u64 = 4 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Running {
    pid: u32,
    session_id: String,
    cwd: String,
    #[serde(default)]
    started_at: u64,
    #[serde(default)]
    name: Option<String>,
}

#[derive(Serialize)]
pub struct Chat {
    session: String,
    transcript: String,
    cwd: String,
    name: Option<String>,
}

#[derive(Serialize)]
pub struct Chunk {
    lines: Vec<String>,
    next: u64,
}

fn claude_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(|home| PathBuf::from(home).join(".claude"))
}

// Claude Code names the folder after the cwd with every UTF-16 unit outside [A-Za-z0-9] turned into '-'
fn project_folder(cwd: &str) -> String {
    cwd.chars()
        .flat_map(|ch| {
            let units = if ch.is_ascii_alphanumeric() {
                1
            } else {
                ch.len_utf16()
            };

            std::iter::repeat_n(if ch.is_ascii_alphanumeric() { ch } else { '-' }, units)
        })
        .collect()
}

// a fresh session writes its transcript only after the first message, so fall back to the path it will use
fn transcript_of(dir: &Path, running: &Running) -> PathBuf {
    let projects = dir.join("projects");
    let file = format!("{}.jsonl", running.session_id);
    let direct = projects.join(project_folder(&running.cwd)).join(&file);

    if direct.is_file() {
        return direct;
    }

    std::fs::read_dir(&projects)
        .into_iter()
        .flatten()
        .flatten()
        .map(|entry| entry.path().join(&file))
        .find(|path| path.is_file())
        .unwrap_or(direct)
}

fn descends(parents: &HashMap<u32, u32>, pid: u32, ancestor: u32) -> bool {
    let mut current = pid;

    for _ in 0..64 {
        if current == ancestor {
            return true;
        }

        match parents.get(&current) {
            Some(&parent) if parent != 0 && parent != current => current = parent,
            _ => return false,
        }
    }

    false
}

#[cfg(windows)]
fn parents() -> HashMap<u32, u32> {
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let mut found = HashMap::new();

    let Ok(snapshot) = (unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }) else {
        return found;
    };

    let mut entry = PROCESSENTRY32W {
        dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
        ..Default::default()
    };
    let mut more = unsafe { Process32FirstW(snapshot, &mut entry) }.is_ok();

    while more {
        found.insert(entry.th32ProcessID, entry.th32ParentProcessID);
        more = unsafe { Process32NextW(snapshot, &mut entry) }.is_ok();
    }

    let _ = unsafe { CloseHandle(snapshot) };

    found
}

#[cfg(not(windows))]
fn parents() -> HashMap<u32, u32> {
    let Ok(output) = std::process::Command::new("ps")
        .args(["-A", "-o", "pid=,ppid="])
        .output()
    else {
        return HashMap::new();
    };

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| {
            let mut fields = line.split_whitespace();
            let pid = fields.next()?.parse().ok()?;
            let parent = fields.next()?.parse().ok()?;

            Some((pid, parent))
        })
        .collect()
}

fn running_sessions(dir: &Path) -> Vec<Running> {
    let Ok(entries) = std::fs::read_dir(dir.join("sessions")) else {
        return Vec::new();
    };

    entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "json"))
        .filter_map(|path| std::fs::read_to_string(path).ok())
        .filter_map(|text| serde_json::from_str::<Running>(&text).ok())
        .collect()
}

#[tauri::command(async)]
pub fn claude_chat(sessions: State<'_, Sessions>, id: u32) -> Result<Option<Chat>, String> {
    let (Some(shell), Some(dir)) = (sessions.shell_pid(id), claude_dir()) else {
        return Ok(None);
    };

    let mut running = running_sessions(&dir);

    if running.is_empty() {
        return Ok(None);
    }

    let parents = parents();

    running.retain(|session| descends(&parents, session.pid, shell));
    running.sort_by_key(|session| std::cmp::Reverse(session.started_at));

    Ok(running.first().map(|session| Chat {
        session: session.session_id.clone(),
        transcript: transcript_of(&dir, session).to_string_lossy().into_owned(),
        cwd: session.cwd.clone(),
        name: session.name.clone(),
    }))
}

#[derive(Serialize)]
pub struct Command {
    name: String,
    description: String,
}

fn frontmatter(text: &str, key: &str) -> Option<String> {
    let mut lines = text.lines();

    if lines.next()?.trim() != "---" {
        return None;
    }

    lines
        .take_while(|line| line.trim() != "---")
        .find_map(|line| line.strip_prefix(key)?.strip_prefix(':'))
        .map(|value| value.trim().trim_matches('"').to_string())
}

fn markdown_commands(folder: &Path, prefix: &str, found: &mut Vec<Command>) {
    let Ok(entries) = std::fs::read_dir(folder) else {
        return;
    };

    for path in entries.flatten().map(|entry| entry.path()) {
        let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) else {
            continue;
        };

        if path.is_dir() {
            markdown_commands(&path, &format!("{prefix}{stem}:"), found);
        } else if path.extension().is_some_and(|ext| ext == "md") {
            let text = std::fs::read_to_string(&path).unwrap_or_default();

            found.push(Command {
                name: format!("{prefix}{stem}"),
                description: frontmatter(&text, "description").unwrap_or_default(),
            });
        }
    }
}

fn skills(folder: &Path, found: &mut Vec<Command>) {
    let Ok(entries) = std::fs::read_dir(folder) else {
        return;
    };

    for dir in entries.flatten().map(|entry| entry.path()) {
        let Ok(text) = std::fs::read_to_string(dir.join("SKILL.md")) else {
            continue;
        };
        let folder_name = dir
            .file_name()
            .map(|name| name.to_string_lossy().into_owned());
        let Some(name) = frontmatter(&text, "name").or(folder_name) else {
            continue;
        };

        found.push(Command {
            name,
            description: frontmatter(&text, "description").unwrap_or_default(),
        });
    }
}

#[tauri::command(async)]
pub fn claude_commands(cwd: String) -> Vec<Command> {
    let mut found = Vec::new();
    let project = PathBuf::from(cwd).join(".claude");

    if let Some(dir) = claude_dir() {
        markdown_commands(&dir.join("commands"), "", &mut found);
        skills(&dir.join("skills"), &mut found);
    }

    markdown_commands(&project.join("commands"), "", &mut found);
    skills(&project.join("skills"), &mut found);

    found.sort_by(|a, b| a.name.cmp(&b.name));
    found.dedup_by(|a, b| a.name == b.name);

    found
}

fn inside_projects(path: &Path) -> Option<PathBuf> {
    let projects = claude_dir()?.join("projects").canonicalize().ok()?;
    let file = path.canonicalize().ok()?;

    (file.starts_with(&projects) && file.extension().is_some_and(|ext| ext == "jsonl"))
        .then_some(file)
}

#[tauri::command(async)]
pub fn claude_transcript(path: String, from: u64) -> Result<Chunk, String> {
    let file = inside_projects(Path::new(&path)).ok_or("not a Claude transcript")?;
    let mut handle = std::fs::File::open(file).map_err(|e| e.to_string())?;
    let length = handle.metadata().map_err(|e| e.to_string())?.len();

    let start = if from > length {
        0
    } else if from == 0 {
        length.saturating_sub(FIRST_READ_LIMIT)
    } else {
        from
    };

    handle
        .seek(SeekFrom::Start(start))
        .map_err(|e| e.to_string())?;

    let mut bytes = Vec::new();

    handle.read_to_end(&mut bytes).map_err(|e| e.to_string())?;

    let Some(end) = bytes.iter().rposition(|byte| *byte == b'\n') else {
        return Ok(Chunk {
            lines: Vec::new(),
            next: start,
        });
    };

    let text = String::from_utf8_lossy(&bytes[..end]);
    let mut lines: Vec<String> = text.lines().map(str::to_string).collect();

    if start > 0 && from == 0 && !lines.is_empty() {
        lines.remove(0);
    }

    Ok(Chunk {
        lines,
        next: start + end as u64 + 1,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_folder_matches_claude_naming() {
        assert_eq!(
            project_folder(r"C:\Projects\pleahmacaka\eris"),
            "C--Projects-pleahmacaka-eris"
        );
        assert_eq!(project_folder("/home/a.b"), "-home-a-b");
        assert_eq!(project_folder("C:\\한글"), "C----");
    }

    #[test]
    fn frontmatter_reads_a_key() {
        let text = "---
name: build
description: \"Ship it\"
---
# body";

        assert_eq!(frontmatter(text, "name").as_deref(), Some("build"));
        assert_eq!(frontmatter(text, "description").as_deref(), Some("Ship it"));
        assert_eq!(frontmatter("# no frontmatter", "name"), None);
    }

    #[test]
    fn descends_walks_the_parent_chain() {
        let parents = HashMap::from([(30, 20), (20, 10), (10, 0)]);

        assert!(descends(&parents, 30, 10));
        assert!(!descends(&parents, 10, 30));
        assert!(!descends(&parents, 99, 10));
    }
}
