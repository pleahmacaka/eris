use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

const ARGS: [&str; 9] = [
    "-p",
    "--verbose",
    "--output-format",
    "stream-json",
    "--input-format",
    "stream-json",
    "--include-partial-messages",
    "--permission-prompt-tool",
    "stdio",
];
const SESSION_LIMIT: usize = 40;

struct Session {
    child: Child,
    stdin: ChildStdin,
}

static SESSIONS: OnceLock<Mutex<HashMap<String, Session>>> = OnceLock::new();

fn sessions() -> &'static Mutex<HashMap<String, Session>> {
    SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Clone, Serialize)]
struct Line {
    key: String,
    line: String,
}

#[derive(Clone, Serialize)]
struct Exit {
    key: String,
    code: Option<i32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Start {
    pub key: String,
    pub cwd: Option<String>,
    pub resume: Option<String>,
    pub plain: bool,
    pub permission_mode: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Transcript {
    pub id: String,
    pub title: String,
    pub modified: u64,
    pub messages: usize,
}

#[derive(Serialize)]
pub struct TranscriptMessage {
    pub role: String,
    pub text: String,
}

fn home() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

fn locate() -> Option<PathBuf> {
    let names = ["claude.exe", "claude.cmd", "claude"];

    let on_path = std::env::var_os("PATH").and_then(|path| {
        std::env::split_paths(&path).find_map(|dir| {
            names
                .iter()
                .map(|name| dir.join(name))
                .find(|candidate| candidate.is_file())
        })
    });

    on_path.or_else(|| {
        let home = home()?;
        let appdata = std::env::var_os("APPDATA").map(PathBuf::from);

        [
            Some(home.join(".local").join("bin").join("claude.exe")),
            appdata.map(|dir| dir.join("npm").join("claude.cmd")),
        ]
        .into_iter()
        .flatten()
        .find(|candidate| candidate.is_file())
    })
}

fn command_for(exe: &Path, args: &[String]) -> Command {
    let script = exe
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("cmd") || ext.eq_ignore_ascii_case("bat"));

    if script {
        let mut command = Command::new("cmd");

        command.arg("/C").arg(exe).args(args);

        return command;
    }

    let mut command = Command::new(exe);

    command.args(args);

    command
}

#[tauri::command]
pub fn claude_which() -> Option<String> {
    locate().map(|path| path.display().to_string())
}

#[tauri::command]
pub fn claude_start(app: AppHandle, options: Start) -> Result<(), String> {
    let exe = locate().ok_or("claude cli not found")?;
    let mut args: Vec<String> = ARGS.iter().map(|arg| (*arg).to_string()).collect();

    if options.plain {
        args.push("--setting-sources".into());
        args.push(String::new());
    }

    if let Some(id) = &options.resume {
        args.push("--resume".into());
        args.push(id.clone());
    }

    if let Some(mode) = options.permission_mode.as_deref().filter(|mode| *mode != "default") {
        args.push("--permission-mode".into());
        args.push(mode.to_string());

        if mode == "bypassPermissions" {
            args.push("--dangerously-skip-permissions".into());
        }
    }

    let cwd = options
        .cwd
        .map(PathBuf::from)
        .or_else(home)
        .ok_or("no working directory")?;

    let mut command = command_for(&exe, &args);

    command
        .current_dir(cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let stdin = child.stdin.take().ok_or("no stdin")?;
    let stdout = child.stdout.take().ok_or("no stdout")?;
    let stderr = child.stderr.take().ok_or("no stderr")?;
    let key = options.key.clone();

    {
        let app = app.clone();
        let key = key.clone();

        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                let _ = app.emit("claude-stderr", Line { key: key.clone(), line });
            }
        });
    }

    {
        let app = app.clone();
        let key = key.clone();

        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                let _ = app.emit("claude-line", Line { key: key.clone(), line });
            }

            let code = sessions()
                .lock()
                .unwrap()
                .remove(&key)
                .and_then(|mut session| session.child.wait().ok())
                .and_then(|status| status.code());

            let _ = app.emit("claude-exit", Exit { key, code });
        });
    }

    sessions()
        .lock()
        .unwrap()
        .insert(key, Session { child, stdin });

    Ok(())
}

#[tauri::command]
pub fn claude_send(key: String, line: String) -> Result<(), String> {
    let mut sessions = sessions().lock().unwrap();
    let session = sessions.get_mut(&key).ok_or("session is gone")?;

    session
        .stdin
        .write_all(line.as_bytes())
        .and_then(|()| session.stdin.write_all(b"\n"))
        .and_then(|()| session.stdin.flush())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn claude_stop(key: String) {
    if let Some(mut session) = sessions().lock().unwrap().remove(&key) {
        let _ = session.child.kill();
    }
}

fn project_dir(cwd: Option<&str>) -> Option<PathBuf> {
    let home = home()?;
    let cwd = match cwd {
        Some(cwd) => cwd.to_string(),
        None => home.display().to_string(),
    };
    let key: String = cwd
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();

    Some(home.join(".claude").join("projects").join(key))
}

fn text_of(content: &serde_json::Value) -> Option<String> {
    if let Some(text) = content.as_str() {
        return Some(text.to_string());
    }

    let parts: Vec<&str> = content
        .as_array()?
        .iter()
        .filter(|block| block.get("type").and_then(|t| t.as_str()) == Some("text"))
        .filter_map(|block| block.get("text").and_then(|t| t.as_str()))
        .collect();

    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

fn is_noise(text: &str) -> bool {
    text.trim_start().starts_with('<')
}

fn messages_of(path: &Path) -> Vec<TranscriptMessage> {
    let Ok(file) = std::fs::File::open(path) else {
        return Vec::new();
    };

    BufReader::new(file)
        .lines()
        .map_while(Result::ok)
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(&line).ok())
        .filter(|entry| entry.get("isMeta").and_then(|m| m.as_bool()) != Some(true))
        .filter_map(|entry| {
            let role = entry.get("type")?.as_str()?;

            if role != "user" && role != "assistant" {
                return None;
            }

            let text = text_of(entry.get("message")?.get("content")?)?;

            if text.trim().is_empty() || (role == "user" && is_noise(&text)) {
                return None;
            }

            Some(TranscriptMessage {
                role: role.to_string(),
                text,
            })
        })
        .collect()
}

#[tauri::command]
pub fn claude_sessions(cwd: Option<String>) -> Vec<Transcript> {
    let Some(dir) = project_dir(cwd.as_deref()) else {
        return Vec::new();
    };

    let Ok(entries) = std::fs::read_dir(&dir) else {
        return Vec::new();
    };

    let mut sessions: Vec<Transcript> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "jsonl"))
        .filter_map(|entry| {
            let path = entry.path();
            let id = path.file_stem()?.to_str()?.to_string();
            let modified = entry
                .metadata()
                .ok()?
                .modified()
                .ok()?
                .duration_since(std::time::UNIX_EPOCH)
                .ok()?
                .as_secs();
            let messages = messages_of(&path);
            let title = messages
                .iter()
                .find(|message| message.role == "user")?
                .text
                .lines()
                .next()
                .unwrap_or_default()
                .chars()
                .take(80)
                .collect();

            Some(Transcript {
                id,
                title,
                modified,
                messages: messages.len(),
            })
        })
        .collect();

    sessions.sort_by(|a, b| b.modified.cmp(&a.modified));
    sessions.truncate(SESSION_LIMIT);

    sessions
}

#[tauri::command]
pub fn claude_transcript(cwd: Option<String>, id: String) -> Vec<TranscriptMessage> {
    match project_dir(cwd.as_deref()) {
        Some(dir) => messages_of(&dir.join(format!("{id}.jsonl"))),
        None => Vec::new(),
    }
}
