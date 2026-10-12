use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::Command;

use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
use winreg::RegKey;

use crate::apps::App;
use crate::{fail, invocation};

pub const MANIFEST_KEY: &str = "eris-installer-windows-x86_64";

const UNINSTALL: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall";

const UPDATE_PREFIX: &str = "eris-installer-update-";

// CREATE_NO_WINDOW: a GUI process otherwise flashes a console for tasklist
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

struct Msi {
    product_code: String,
    version: String,
}

fn nsis(app: &App) -> Option<String> {
    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(format!(r"{UNINSTALL}\{}", app.product))
        .ok()?
        .get_value("DisplayVersion")
        .ok()
}

fn msi(app: &App) -> Option<Msi> {
    [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE]
        .into_iter()
        .filter_map(|hive| RegKey::predef(hive).open_subkey(UNINSTALL).ok())
        .find_map(|uninstall| {
            uninstall.enum_keys().flatten().find_map(|code| {
                let entry = uninstall.open_subkey(&code).ok()?;
                let name: String = entry.get_value("DisplayName").ok()?;
                let packaged: u32 = entry.get_value("WindowsInstaller").ok()?;

                (packaged == 1 && name == app.product).then(|| Msi {
                    version: entry.get_value("DisplayVersion").unwrap_or_default(),
                    product_code: code,
                })
            })
        })
}

pub fn installed(app: &App) -> Option<String> {
    nsis(app).or_else(|| msi(app).map(|found| found.version))
}

fn status(mut command: Command) -> Result<(), String> {
    match command.status() {
        Ok(status) if status.success() => Ok(()),
        Ok(status) => Err(format!("exited with {status}")),
        Err(error) => Err(error.to_string()),
    }
}

fn command_line() -> String {
    let line = unsafe { windows_sys::Win32::System::Environment::GetCommandLineW() };
    let length = (0..)
        .take_while(|&at| unsafe { *line.add(at) } != 0)
        .count();

    String::from_utf16_lossy(unsafe { std::slice::from_raw_parts(line, length) })
}

fn arguments(line: &str) -> &str {
    match line.strip_prefix('"') {
        Some(quoted) => quoted.split_once('"').map_or("", |(_, rest)| rest),
        None => line.split_once(' ').map_or("", |(_, rest)| rest),
    }
}

// the updater quotes its forwarded args for NSIS, so the tail must be passed on verbatim
fn from_flag<'a>(args: &'a str, flag: &str) -> Option<&'a str> {
    args.match_indices(flag)
        .map(|(at, _)| at)
        .find(|&at| {
            let before = args[..at].chars().next_back();
            let after = args[at + flag.len()..].chars().next();

            before.is_none_or(char::is_whitespace) && after.is_none_or(char::is_whitespace)
        })
        .map(|at| &args[at..])
}

fn binary(app: &App) -> String {
    match app.id {
        "eris" => "eris.exe".to_string(),
        id => format!("eris-{id}.exe"),
    }
}

fn running(app: &App) -> bool {
    let image = binary(app);

    Command::new("tasklist")
        .args(["/FI", &format!("IMAGENAME eq {image}"), "/NH"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .is_ok_and(|out| {
            String::from_utf8_lossy(&out.stdout)
                .to_lowercase()
                .contains(&image)
        })
}

// the NSIS template kills a running app under /P and /S, so anything running is relaunched with /R
fn setup_command(app: &App, setup: &Path) -> Command {
    let call = invocation();
    let line = command_line();
    let mut command = Command::new(setup);

    command.arg(if call.update && !call.quiet {
        "/P"
    } else {
        "/S"
    });

    if nsis(app).is_some() {
        command.arg("/UPDATE");
    }

    match (app.id, call.update) {
        ("eris", true) => {
            if let Some(tail) = from_flag(arguments(&line), "/R") {
                command.raw_arg(tail);
            }
        }
        ("eris", false) => {
            command.arg("/R");
        }
        _ if running(app) => {
            command.arg("/R");
        }
        _ => {}
    }

    command
}

// releases up to 0.3.12 also shipped an MSI; remove it so the NSIS install does not land beside it
fn remove_msi(app: &App) -> Result<(), String> {
    let Some(found) = msi(app) else {
        return Ok(());
    };
    let mut command = Command::new("msiexec");

    command.args(["/x", &found.product_code, "/passive", "/norestart"]);

    status(command).map_err(|error| format!("removing the MSI install failed: {error}"))
}

fn run_setup(app: &App, payload: &[u8]) -> Result<(), String> {
    remove_msi(app)?;

    let dir = tempfile::Builder::new()
        .prefix("eris-installer-")
        .tempdir()
        .map_err(fail)?;
    let setup = dir.path().join(format!("{}-setup.exe", app.id));

    std::fs::write(&setup, payload).map_err(fail)?;

    status(setup_command(app, &setup)).map_err(|error| format!("setup {error}"))
}

fn relaunch_eris() {
    let line = command_line();
    let args =
        from_flag(arguments(&line), "/ARGS").map_or("", |tail| tail["/ARGS".len()..].trim_start());
    let dir: Option<String> = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\eris\eris")
        .ok()
        .and_then(|key| key.get_value("").ok());

    if let Some(dir) = dir {
        let _ = Command::new(Path::new(&dir).join("eris.exe"))
            .raw_arg(args)
            .spawn();
    }
}

pub fn install(app: &App, payload: &[u8]) -> Result<(), String> {
    let result = run_setup(app, payload);

    // Eris's updater already exited, so a failed eris setup must not leave the user without the shell
    if result.is_err() && app.id == "eris" && invocation().update {
        relaunch_eris();
    }

    result
}

pub fn launch_installer(bytes: &[u8], version: &str) -> Result<(), String> {
    let temp = std::env::temp_dir();

    for stale in std::fs::read_dir(&temp).into_iter().flatten().flatten() {
        if stale
            .file_name()
            .to_string_lossy()
            .starts_with(UPDATE_PREFIX)
        {
            let _ = std::fs::remove_dir_all(stale.path());
        }
    }

    let dir = tempfile::Builder::new()
        .prefix(UPDATE_PREFIX)
        .tempdir_in(&temp)
        .map_err(fail)?
        .keep();
    let path = dir.join(format!("Eris_{version}_installer.exe"));

    std::fs::write(&path, bytes).map_err(fail)?;
    Command::new(path).spawn().map_err(fail)?;

    Ok(())
}
