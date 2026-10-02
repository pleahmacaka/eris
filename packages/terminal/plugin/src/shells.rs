use std::env;
use std::path::PathBuf;

use serde::Serialize;
use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
use winreg::RegKey;

#[derive(Clone, Serialize)]
pub struct Shell {
    id: String,
    name: String,
    #[serde(skip)]
    pub program: PathBuf,
    #[serde(skip)]
    args: Vec<String>,
}

impl Shell {
    fn new(id: &str, name: &str, program: PathBuf, args: &[&str]) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            program,
            args: args.iter().map(|arg| arg.to_string()).collect(),
        }
    }

    pub fn args(&self, has_cwd: bool) -> Vec<String> {
        let mut args = self.args.clone();

        if self.id.starts_with("wsl:") && !has_cwd {
            args.extend(["--cd".to_string(), "~".to_string()]);
        }

        args
    }
}

fn system_root() -> PathBuf {
    env::var_os("SystemRoot")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Windows"))
}

fn on_path(name: &str) -> Option<PathBuf> {
    env::split_paths(&env::var_os("PATH")?)
        .map(|dir| dir.join(name))
        .find(|path| std::fs::symlink_metadata(path).is_ok_and(|meta| !meta.is_dir()))
}

fn existing(path: PathBuf) -> Option<PathBuf> {
    path.is_file().then_some(path)
}

fn pwsh() -> Option<PathBuf> {
    on_path("pwsh.exe").or_else(|| {
        let programs = env::var_os("ProgramFiles")?;

        existing(PathBuf::from(programs).join(r"PowerShell\7\pwsh.exe"))
    })
}

fn git_bash() -> Option<PathBuf> {
    let installed = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\GitForWindows")
        .and_then(|key| key.get_value::<String, _>("InstallPath"))
        .ok()
        .map(PathBuf::from);

    let fallback = env::var_os("ProgramFiles").map(|programs| PathBuf::from(programs).join("Git"));

    [installed, fallback]
        .into_iter()
        .flatten()
        .find_map(|root| existing(root.join(r"bin\bash.exe")))
}

fn wsl_distros() -> Vec<String> {
    let Ok(lxss) = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Lxss")
    else {
        return Vec::new();
    };

    lxss.enum_keys()
        .flatten()
        .filter_map(|guid| lxss.open_subkey(guid).ok())
        .filter_map(|key| key.get_value::<String, _>("DistributionName").ok())
        .filter(|name| !name.starts_with("docker-desktop"))
        .collect()
}

fn detect() -> Vec<Shell> {
    let root = system_root();
    let mut found = Vec::new();

    if let Some(program) = pwsh() {
        found.push(Shell::new("pwsh", "PowerShell", program, &["-NoLogo"]));
    }

    if let Some(program) = existing(root.join(r"System32\WindowsPowerShell\v1.0\powershell.exe")) {
        found.push(Shell::new(
            "powershell",
            "Windows PowerShell",
            program,
            &["-NoLogo"],
        ));
    }

    let cmd = env::var_os("ComSpec")
        .map(PathBuf::from)
        .unwrap_or_else(|| root.join(r"System32\cmd.exe"));

    found.push(Shell::new("cmd", "Command Prompt", cmd, &[]));

    if let Some(wsl) = existing(root.join(r"System32\wsl.exe")) {
        for distro in wsl_distros() {
            found.push(Shell::new(
                &format!("wsl:{distro}"),
                &distro,
                wsl.clone(),
                &["-d", &distro],
            ));
        }
    }

    if let Some(program) = git_bash() {
        found.push(Shell::new(
            "git-bash",
            "Git Bash",
            program,
            &["--login", "-i"],
        ));
    }

    found
}

pub fn find(id: &str) -> Option<Shell> {
    detect().into_iter().find(|shell| shell.id == id)
}

#[tauri::command(async)]
pub fn shells() -> Vec<Shell> {
    detect()
}
