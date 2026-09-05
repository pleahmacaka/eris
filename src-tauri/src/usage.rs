use std::path::PathBuf;

use serde::Serialize;
use serde_json::Value;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub used: f64,
    pub resets_at: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeUsage {
    pub source: String,
    pub updated_at: Option<String>,
    pub five_hour: Option<UsageWindow>,
    pub seven_day: Option<UsageWindow>,
}

fn home() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

fn candidates(configured: Option<String>) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Some(path) = configured.filter(|path| !path.trim().is_empty()) {
        paths.push(PathBuf::from(path.trim()));
    }

    if let Some(home) = home() {
        let claude = home.join(".claude");

        paths.push(claude.join("eris-usage.json"));
        paths.push(claude.join("usage.json"));
        paths.push(claude.join("plugins/claude-hud/usage.json"));
    }

    paths
}

fn number(value: &Value) -> Option<f64> {
    match value {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => text.trim_end_matches('%').parse().ok(),
        _ => None,
    }
}

fn window(value: Option<&Value>) -> Option<UsageWindow> {
    let value = value?;

    let used = ["used_percentage", "usedPercentage", "utilization", "used"]
        .iter()
        .find_map(|key| value.get(key).and_then(number))?;

    let resets_at = ["resets_at", "resetsAt", "reset_at"]
        .iter()
        .find_map(|key| value.get(key).and_then(Value::as_str))
        .map(str::to_owned);

    Some(UsageWindow { used, resets_at })
}

fn parse(text: &str, source: String) -> Option<ClaudeUsage> {
    let root: Value = serde_json::from_str(text).ok()?;
    let limits = root.get("rate_limits").unwrap_or(&root);

    let five_hour = window(limits.get("five_hour").or_else(|| limits.get("fiveHour")));
    let seven_day = window(limits.get("seven_day").or_else(|| limits.get("sevenDay")));

    if five_hour.is_none() && seven_day.is_none() {
        return None;
    }

    Some(ClaudeUsage {
        source,
        updated_at: root
            .get("updated_at")
            .and_then(Value::as_str)
            .map(str::to_owned),
        five_hour,
        seven_day,
    })
}

fn snapshot_path() -> Option<PathBuf> {
    Some(home()?.join(".claude").join("eris-usage.json"))
}

fn settings_path() -> Option<PathBuf> {
    Some(home()?.join(".claude").join("settings.json"))
}

fn snapshot_of(payload: &Value) -> Option<Value> {
    let limits = payload.get("rate_limits")?;
    let keep = |name: &str| {
        window(limits.get(name)).map(|found| {
            serde_json::json!({
                "used_percentage": found.used,
                "resets_at": found.resets_at,
            })
        })
    };

    let five_hour = keep("five_hour");
    let seven_day = keep("seven_day");

    if five_hour.is_none() && seven_day.is_none() {
        return None;
    }

    Some(serde_json::json!({
        "updated_at": stamp(),
        "five_hour": five_hour,
        "seven_day": seven_day,
    }))
}

fn stamp() -> String {
    let seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|since| since.as_secs())
        .unwrap_or_default();

    format!("{seconds}")
}

fn chain_argument(command: &str) -> Option<String> {
    let marker = "--chain ";
    let start = command.find(marker)? + marker.len();
    let rest = command[start..].trim_start();
    let quoted = rest.strip_prefix('"')?;
    let end = quoted.find('"')?;

    Some(quoted[..end].to_owned())
}

pub fn bridge(chain: Option<String>) {
    use std::io::Read;

    let mut payload = String::new();
    let _ = std::io::stdin().read_to_string(&mut payload);

    if let (Ok(parsed), Some(target)) =
        (serde_json::from_str::<Value>(&payload), snapshot_path())
    {
        if let Some(snapshot) = snapshot_of(&parsed) {
            let _ = target.parent().map(std::fs::create_dir_all);
            let _ = std::fs::write(&target, snapshot.to_string());
        }
    }

    let Some(chain) = chain.filter(|command| !command.trim().is_empty()) else {
        return;
    };

    let mut child = match std::process::Command::new(shell())
        .arg(shell_flag())
        .arg(&chain)
        .stdin(std::process::Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(_) => return,
    };

    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;

        let _ = stdin.write_all(payload.as_bytes());
    }

    let _ = child.wait();
}

fn shell() -> &'static str {
    if cfg!(target_os = "windows") {
        "cmd"
    } else {
        "sh"
    }
}

fn shell_flag() -> &'static str {
    if cfg!(target_os = "windows") {
        "/c"
    } else {
        "-c"
    }
}

#[tauri::command(async)]
pub fn usage_bridge_installed() -> bool {
    let Some(path) = settings_path() else {
        return false;
    };

    std::fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|value| {
            value
                .get("statusLine")?
                .get("command")?
                .as_str()
                .map(|command| command.contains("--usage-bridge"))
        })
        .unwrap_or(false)
}

#[tauri::command(async)]
pub fn install_usage_bridge(enable: bool) -> Result<(), String> {
    let path = settings_path().ok_or("no home directory")?;

    let mut root: Value = std::fs::read_to_string(&path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_else(|| serde_json::json!({}));

    let current = root
        .get("statusLine")
        .and_then(|line| line.get("command"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_owned();

    let installed = current.contains("--usage-bridge");

    if enable == installed {
        return Ok(());
    }

    if enable {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let mut command = format!("\"{}\" --usage-bridge", exe.display());

        if !current.is_empty() {
            command.push_str(&format!(" --chain \"{current}\""));
        }

        root["statusLine"] = serde_json::json!({ "type": "command", "command": command });
    } else if let Some(previous) = chain_argument(&current) {
        root["statusLine"] = serde_json::json!({ "type": "command", "command": previous });
    } else if let Some(object) = root.as_object_mut() {
        object.remove("statusLine");
    }

    let text = serde_json::to_string_pretty(&root).map_err(|e| e.to_string())?;

    let _ = path.parent().map(std::fs::create_dir_all);

    std::fs::write(&path, text).map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn claude_usage(path: Option<String>) -> Option<ClaudeUsage> {
    candidates(path).into_iter().find_map(|file| {
        let text = std::fs::read_to_string(&file).ok()?;

        parse(&text, file.to_string_lossy().into_owned())
    })
}

#[cfg(test)]
mod tests {
    use super::parse;

    #[test]
    fn a_statusline_snapshot_yields_both_windows() {
        let snapshot = r#"{
            "updated_at": "2026-09-05T00:00:00.000Z",
            "five_hour": { "used_percentage": 42, "resets_at": "2026-09-05T03:00:00.000Z" },
            "seven_day": { "used_percentage": "85%" }
        }"#;

        let usage = parse(snapshot, "test".into()).expect("snapshot rejected");

        assert_eq!(usage.five_hour.as_ref().map(|w| w.used), Some(42.0));
        assert_eq!(usage.seven_day.as_ref().map(|w| w.used), Some(85.0));
        assert!(usage.five_hour.unwrap().resets_at.is_some());
    }

    #[test]
    fn a_raw_statusline_payload_is_unwrapped() {
        let payload = r#"{ "rate_limits": { "five_hour": { "utilization": 7 } } }"#;

        let usage = parse(payload, "test".into()).expect("payload rejected");

        assert_eq!(usage.five_hour.map(|w| w.used), Some(7.0));
        assert!(usage.seven_day.is_none());
    }

    #[test]
    fn the_previous_statusline_survives_a_round_trip() {
        let installed = r#""C:\erispp.exe" --usage-bridge --chain "bun hud.ts""#;

        assert_eq!(
            super::chain_argument(installed).as_deref(),
            Some("bun hud.ts")
        );
        assert!(super::chain_argument(r#""app.exe" --usage-bridge"#).is_none());
    }

    #[test]
    fn a_statusline_payload_becomes_a_snapshot() {
        let payload: serde_json::Value = serde_json::from_str(
            r#"{ "rate_limits": { "five_hour": { "used_percentage": 12, "resets_at": "later" } } }"#,
        )
        .unwrap();

        let snapshot = super::snapshot_of(&payload).expect("payload rejected");

        assert_eq!(snapshot["five_hour"]["used_percentage"], 12.0);
        assert!(snapshot["seven_day"].is_null());
    }

    #[test]
    fn a_snapshot_without_windows_is_ignored() {
        assert!(parse(r#"{ "hello": 1 }"#, "test".into()).is_none());
    }
}
