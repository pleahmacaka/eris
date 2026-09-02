use serde::Serialize;

use crate::{apps, audio};

#[derive(Serialize)]
pub struct Battery {
    pub percent: u8,
    pub charging: bool,
}

#[derive(Serialize)]
pub struct SystemInfo {
    pub battery: Option<Battery>,
    pub volume: Option<audio::Volume>,
}

#[tauri::command]
pub fn system_accent() -> Option<String> {
    win::accent()
}

#[tauri::command(async)]
pub fn system_info() -> SystemInfo {
    SystemInfo {
        battery: win::battery(),
        volume: audio::volume(),
    }
}

#[tauri::command]
pub fn power_action(action: String) -> Result<(), String> {
    match action.as_str() {
        "lock" => win::lock(),
        "sleep" => win::suspend(false),
        "hibernate" => win::suspend(true),
        "shutdown" => win::run_hidden("shutdown", &["/s", "/t", "0"]),
        "restart" => win::run_hidden("shutdown", &["/r", "/t", "0"]),
        "signout" => win::run_hidden("shutdown", &["/l"]),
        other => Err(format!("unknown power action {other}")),
    }
}

#[tauri::command]
pub fn empty_recycle_bin() -> Result<(), String> {
    win::empty_recycle_bin()
}

#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    apps::shell_execute("open", &url, None, true)
}

#[tauri::command]
pub fn run_command(command: String) -> Result<(), String> {
    apps::shell_execute(
        "open",
        "cmd.exe",
        Some(&format!("/c start \"\" {command}")),
        false,
    )
}

#[tauri::command]
pub fn machine_name() -> String {
    ["COMPUTERNAME", "HOSTNAME"]
        .iter()
        .find_map(|var| std::env::var(var).ok())
        .unwrap_or_else(|| "Eris".into())
}

#[tauri::command]
pub fn open_data_folder(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    apps::shell_execute("open", &dir.to_string_lossy(), None, true)
}

#[cfg(target_os = "windows")]
mod win {
    use std::os::windows::process::CommandExt;

    use windows::core::{w, PCWSTR};
    use windows::Win32::Foundation::E_UNEXPECTED;
    use windows::Win32::System::Power::{
        GetSystemPowerStatus, SetSuspendState, SYSTEM_POWER_STATUS,
    };
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_DWORD};
    use windows::Win32::System::Shutdown::LockWorkStation;
    use windows::Win32::System::Threading::CREATE_NO_WINDOW;
    use windows::Win32::UI::Shell::{SHEmptyRecycleBinW, SHERB_NOCONFIRMATION, SHERB_NOPROGRESSUI};

    use super::Battery;

    pub fn accent() -> Option<String> {
        let mut value: u32 = 0;
        let mut size = std::mem::size_of::<u32>() as u32;

        let status = unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                w!(r"Software\Microsoft\Windows\DWM"),
                w!("AccentColor"),
                RRF_RT_REG_DWORD,
                None,
                Some(&mut value as *mut u32 as *mut _),
                Some(&mut size),
            )
        };

        if status.is_err() {
            return None;
        }

        let (red, green, blue) = (value & 0xFF, (value >> 8) & 0xFF, (value >> 16) & 0xFF);

        Some(format!("#{red:02x}{green:02x}{blue:02x}"))
    }

    pub fn battery() -> Option<Battery> {
        let mut status = SYSTEM_POWER_STATUS::default();

        unsafe { GetSystemPowerStatus(&mut status) }.ok()?;

        if status.BatteryFlag & 128 != 0 || status.BatteryLifePercent == 255 {
            return None;
        }

        Some(Battery {
            percent: status.BatteryLifePercent,
            charging: status.ACLineStatus == 1,
        })
    }

    pub fn lock() -> Result<(), String> {
        unsafe { LockWorkStation() }.map_err(|e| e.to_string())
    }

    // ponytail: SetSuspendState returns only after resume, so it runs off the caller's thread
    pub fn suspend(hibernate: bool) -> Result<(), String> {
        std::thread::spawn(move || unsafe { SetSuspendState(hibernate, false, false) });

        Ok(())
    }

    pub fn run_hidden(program: &str, args: &[&str]) -> Result<(), String> {
        std::process::Command::new(program)
            .args(args)
            .creation_flags(CREATE_NO_WINDOW.0)
            .spawn()
            .map(drop)
            .map_err(|e| e.to_string())
    }

    pub fn empty_recycle_bin() -> Result<(), String> {
        let result = unsafe {
            SHEmptyRecycleBinW(
                None,
                PCWSTR::null(),
                SHERB_NOCONFIRMATION | SHERB_NOPROGRESSUI,
            )
        };

        match result {
            // an already empty bin reports E_UNEXPECTED
            Err(error) if error.code() != E_UNEXPECTED => Err(error.to_string()),
            _ => Ok(()),
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::Battery;

    pub fn accent() -> Option<String> {
        None
    }

    pub fn battery() -> Option<Battery> {
        None
    }

    pub fn lock() -> Result<(), String> {
        Err("unsupported platform".into())
    }

    pub fn suspend(_hibernate: bool) -> Result<(), String> {
        Err("unsupported platform".into())
    }

    pub fn run_hidden(program: &str, args: &[&str]) -> Result<(), String> {
        std::process::Command::new(program)
            .args(args)
            .spawn()
            .map(drop)
            .map_err(|e| e.to_string())
    }

    pub fn empty_recycle_bin() -> Result<(), String> {
        Err("unsupported platform".into())
    }
}
