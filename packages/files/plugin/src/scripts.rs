use std::env;
use std::path::Path;

use serde::Serialize;
use serde_json::Value;

const MANAGERS: [&str; 5] = ["bun", "pnpm", "yarn", "npm", "deno"];

const LOCKFILES: [(&str, &str); 7] = [
    ("bun.lock", "bun"),
    ("bun.lockb", "bun"),
    ("pnpm-lock.yaml", "pnpm"),
    ("yarn.lock", "yarn"),
    ("package-lock.json", "npm"),
    ("npm-shrinkwrap.json", "npm"),
    ("deno.lock", "deno"),
];

#[derive(Serialize)]
pub struct Script {
    name: String,
    command: String,
}

#[derive(Serialize)]
pub struct Scripts {
    scripts: Vec<Script>,
    manager: Option<String>,
}

fn declared(manifest: &Value) -> Option<String> {
    let field = manifest.get("packageManager")?.as_str()?;
    let name = field.split('@').next()?;

    MANAGERS.contains(&name).then(|| name.to_string())
}

// a workspace member has no lockfile of its own, so the nearest ancestor that has one decides
fn locked(dir: &Path) -> Option<String> {
    dir.ancestors().find_map(|folder| {
        LOCKFILES
            .iter()
            .find(|(file, _)| folder.join(file).is_file())
            .map(|(_, manager)| manager.to_string())
    })
}

fn installed(name: &str) -> bool {
    let Some(path) = env::var_os("PATH") else {
        return false;
    };
    let extensions: Vec<String> = if cfg!(windows) {
        env::var("PATHEXT")
            .unwrap_or_else(|_| ".EXE;.CMD;.BAT".to_string())
            .split(';')
            .map(str::to_lowercase)
            .collect()
    } else {
        vec![String::new()]
    };

    env::split_paths(&path).any(|dir| {
        extensions
            .iter()
            .any(|extension| dir.join(format!("{name}{extension}")).is_file())
    })
}

#[tauri::command(async)]
pub fn package_scripts(dir: String) -> Option<Scripts> {
    let dir = Path::new(&dir);
    let text = std::fs::read_to_string(dir.join("package.json")).ok()?;
    let manifest: Value = serde_json::from_str(&text).ok()?;
    let scripts = manifest
        .get("scripts")
        .and_then(Value::as_object)
        .map(|scripts| {
            scripts
                .iter()
                .filter_map(|(name, command)| {
                    Some(Script {
                        name: name.clone(),
                        command: command.as_str()?.to_string(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Some(Scripts {
        scripts,
        manager: declared(&manifest).or_else(|| locked(dir)),
    })
}

#[tauri::command(async)]
pub fn package_managers() -> Vec<String> {
    MANAGERS
        .iter()
        .filter(|name| installed(name))
        .map(|name| name.to_string())
        .collect()
}
