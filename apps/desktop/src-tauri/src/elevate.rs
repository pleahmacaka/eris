use std::ffi::{OsStr, OsString};
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::os::windows::io::AsRawHandle;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::windows::named_pipe::{
    ClientOptions, NamedPipeClient, NamedPipeServer, ServerOptions,
};
use tokio::sync::mpsc::{unbounded_channel, UnboundedSender};
use windows::core::{w, GUID, HSTRING, PCWSTR, PWSTR};
use windows::Win32::Foundation::{CloseHandle, ERROR_CANCELLED, HANDLE, HWND};
use windows::Win32::Storage::FileSystem::{
    MoveFileExW, MOVEFILE_DELAY_UNTIL_REBOOT, SECURITY_IDENTIFICATION,
};
use windows::Win32::System::Com::CoTaskMemFree;
use windows::Win32::System::Console::FreeConsole;
use windows::Win32::System::Pipes::{GetNamedPipeClientProcessId, GetNamedPipeServerProcessId};
use windows::Win32::System::RemoteDesktop::ProcessIdToSessionId;
use windows::Win32::System::Threading::{
    GetCurrentProcess, GetExitCodeProcess, OpenProcess, QueryFullProcessImageNameW,
    SetPriorityClass, WaitForSingleObject, CREATE_NO_WINDOW, HIGH_PRIORITY_CLASS, INFINITE,
    PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Shell::{
    FOLDERID_ProgramFiles, FOLDERID_System, SHGetKnownFolderPath, ShellExecuteExW, KF_FLAG_DEFAULT,
    SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
};
use windows::Win32::UI::WindowsAndMessaging::{GetWindowThreadProcessId, SW_HIDE};

pub const HOOK_ARG: &str = "--win-hook";
pub const INSTALL_ARG: &str = "--install-win-hook";
pub const REMOVE_ARG: &str = "--remove-win-hook";

// the elevated copy is refreshed only on a mismatch, so bump this whenever the hook or the frames change
const REVISION: u8 = 1;
const HELPER_NAME: &str = "eris-win-key-hook";
const SKIPPED: &str = "win-key-hook-skipped";

const CONNECT_WAIT: Duration = Duration::from_secs(15);
const FOCUS_WAIT: Duration = Duration::from_secs(1);
const POLL: Duration = Duration::from_millis(50);
const RETRY: Duration = Duration::from_millis(250);
const RETRIES: usize = 20;

const CAPTURE_FRAME: u8 = 0;
const RAISE_FRAME: u8 = 1;
const TAP: u8 = 2;

static STARTED: AtomicBool = AtomicBool::new(false);
static OFFER: AtomicBool = AtomicBool::new(false);
static HELPER: Mutex<Option<UnboundedSender<[u8; 9]>>> = Mutex::new(None);

pub fn capture(app: &AppHandle, enabled: bool) {
    send(CAPTURE_FRAME, enabled as u64);

    if enabled && !STARTED.swap(true, Ordering::Relaxed) {
        let app = app.clone();

        std::thread::spawn(move || tauri::async_runtime::block_on(start(app)));
    }
}

// UAC pops over a foreground requester only and otherwise flashes in a taskbar the dock may hide, so ask right after a tap focused the launcher
pub fn offer(app: &AppHandle) {
    if OFFER.swap(false, Ordering::Relaxed) {
        let app = app.clone();

        std::thread::spawn(move || tauri::async_runtime::block_on(setup(app)));
    }
}

pub fn raise(raw: isize) -> bool {
    send(RAISE_FRAME, raw as u64)
}

fn frame(tag: u8, value: u64) -> [u8; 9] {
    let mut frame = [tag; 9];
    frame[1..].copy_from_slice(&value.to_le_bytes());

    frame
}

fn send(tag: u8, value: u64) -> bool {
    HELPER
        .lock()
        .unwrap()
        .as_ref()
        .is_some_and(|helper| helper.send(frame(tag, value)).is_ok())
}

enum NotReady {
    Install,
    Transient,
}

async fn start(app: AppHandle) {
    match connect().await {
        Ok(pipe) => serve(app, pipe).await,
        // a transient miss retries next launch on its own; only a real absence is worth a prompt
        Err(NotReady::Install) => OFFER.store(!skipped(&app), Ordering::Relaxed),
        Err(NotReady::Transient) => {}
    }
}

async fn setup(app: AppHandle) {
    let Some(owner) = focused_launcher(&app).await else {
        OFFER.store(true, Ordering::Relaxed);

        return;
    };

    match elevate(owner, INSTALL_ARG) {
        Ok(true) => {}
        Ok(false) => return skip(&app),
        Err(error) => return log::warn!("elevated win key hook setup failed: {error}"),
    }

    match connect().await {
        Ok(pipe) => serve(app, pipe).await,
        Err(_) => log::warn!("elevated win key hook did not start after install"),
    }
}

async fn focused_launcher(app: &AppHandle) -> Option<HWND> {
    let window = app.get_webview_window("main")?;

    for _ in 0..FOCUS_WAIT.as_millis() / POLL.as_millis() {
        if window.is_focused().unwrap_or(false) {
            return window.hwnd().ok();
        }

        tokio::time::sleep(POLL).await;
    }

    None
}

async fn connect() -> Result<NamedPipeServer, NotReady> {
    let helper = helper_path().map_err(|_| NotReady::Transient)?;

    if !helper.exists() {
        return Err(NotReady::Install);
    }

    let mut pipe = ServerOptions::new()
        .first_pipe_instance(true)
        .max_instances(1)
        .create(pipe_name())
        .map_err(|e| transient("win key pipe", e))?;

    schtasks(&["/run", "/tn", &task_name()]).map_err(|e| transient("win key task", e))?;

    let handshake = async {
        pipe.connect().await?;
        pipe.read_u8().await
    };

    let revision = match tokio::time::timeout(CONNECT_WAIT, handshake).await {
        Ok(Ok(revision)) => revision,
        Ok(Err(e)) => return Err(transient("helper handshake", e)),
        Err(_) => return Err(transient("helper connect", "timed out")),
    };

    // the pipe only toggles our hook, but still refuse a connector that is not the installed helper
    if !client_is(&pipe, &helper) {
        return Err(NotReady::Transient);
    }

    if revision != REVISION {
        log::warn!("elevated win key hook revision {revision}, want {REVISION}");

        return Err(NotReady::Install);
    }

    Ok(pipe)
}

fn transient(what: &str, error: impl std::fmt::Display) -> NotReady {
    log::warn!("{what} failed: {error}");

    NotReady::Transient
}

fn client_is(pipe: &NamedPipeServer, helper: &Path) -> bool {
    let mut pid = 0;

    if unsafe { GetNamedPipeClientProcessId(HANDLE(pipe.as_raw_handle()), &mut pid) }.is_err() {
        return false;
    }

    pid_path(pid).is_some_and(|path| path == helper)
}

fn pid_path(pid: u32) -> Option<PathBuf> {
    let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) }.ok()?;
    let mut buffer = [0u16; 512];
    let mut len = buffer.len() as u32;

    let query = unsafe {
        QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_WIN32,
            PWSTR(buffer.as_mut_ptr()),
            &mut len,
        )
    };

    let _ = unsafe { CloseHandle(process) };
    query.ok()?;

    Some(PathBuf::from(OsString::from_wide(&buffer[..len as usize])))
}

async fn serve(app: AppHandle, pipe: NamedPipeServer) {
    let (mut reader, mut writer) = tokio::io::split(pipe);
    let (sender, mut frames) = unbounded_channel::<[u8; 9]>();

    {
        // read capture state under the lock so a concurrent toggle cannot slip its frame ahead of ours
        let mut helper = HELPER.lock().unwrap();
        let first = frame(CAPTURE_FRAME, crate::winkey::capturing() as u64);

        *helper = Some(sender);

        if let Some(helper) = helper.as_ref() {
            let _ = helper.send(first);
        }
    }

    crate::winkey::delegate(true);
    log::info!("elevated win key hook connected");

    tauri::async_runtime::spawn(async move {
        while let Some(frame) = frames.recv().await {
            if writer.write_all(&frame).await.is_err() {
                break;
            }
        }
    });

    while let Ok(frame) = reader.read_u8().await {
        if frame == TAP {
            crate::winkey::lone_tap(&app);
        }
    }

    *HELPER.lock().unwrap() = None;
    crate::winkey::delegate(false);
    log::warn!("elevated win key hook disconnected");
}

pub fn helper() {
    // debug builds are console apps, and the elevated console in front would drop input injected by normal windows
    let _ = unsafe { FreeConsole() };

    // a busy game starves a normal priority hook past LowLevelHooksTimeout, and Windows then lets the key through
    let _ = unsafe { SetPriorityClass(GetCurrentProcess(), HIGH_PRIORITY_CLASS) };
    let _ = tauri::async_runtime::block_on(relay());

    crate::winkey::release();
}

async fn relay() -> std::io::Result<()> {
    let pipe = open().await?;
    let owner = server_process(&pipe);
    let (mut reader, mut writer) = tokio::io::split(pipe);
    let (taps, mut tapped) = unbounded_channel::<()>();

    crate::winkey::install(move || {
        let _ = taps.send(());
    });

    // claim the channel only once the hook is live, so Eris never delegates to a dead helper
    for _ in 0..RETRIES {
        if crate::winkey::hook_ready() {
            break;
        }

        tokio::time::sleep(RETRY).await;
    }

    if !crate::winkey::hook_ready() {
        return Ok(());
    }

    writer.write_u8(REVISION).await?;

    tauri::async_runtime::spawn(async move {
        while tapped.recv().await.is_some() {
            if writer.write_u8(TAP).await.is_err() {
                break;
            }
        }
    });

    let mut frame = [0; 9];

    while reader.read_exact(&mut frame).await.is_ok() {
        let mut value = [0; 8];
        value.copy_from_slice(&frame[1..]);

        let value = u64::from_le_bytes(value);

        match frame[0] {
            CAPTURE_FRAME => crate::winkey::capture(value != 0),
            RAISE_FRAME if window_process(value as isize) == owner => {
                crate::winkey::raise(value as isize)
            }
            _ => {}
        }
    }

    Ok(())
}

async fn open() -> std::io::Result<NamedPipeClient> {
    let name = pipe_name();
    let mut attempt = 0;

    loop {
        // the pipe server is untrusted; identification level keeps it from impersonating this elevated client
        let opened = ClientOptions::new()
            .security_qos_flags(SECURITY_IDENTIFICATION.0)
            .open(&name);

        match opened {
            Err(_) if attempt < RETRIES => {
                attempt += 1;
                tokio::time::sleep(RETRY).await;
            }
            result => return result,
        }
    }
}

// one shared name lets a second Windows account overwrite the first account's task
fn task_name() -> String {
    let user = std::env::var("USERNAME").unwrap_or_default();

    format!(r"\eris\win key hook {user}")
}

fn pipe_name() -> String {
    let mut session = 0;
    let _ = unsafe { ProcessIdToSessionId(std::process::id(), &mut session) };

    format!(r"\\.\pipe\{HELPER_NAME}-{session}")
}

fn server_process(pipe: &NamedPipeClient) -> u32 {
    let mut process = 0;
    let _ = unsafe { GetNamedPipeServerProcessId(HANDLE(pipe.as_raw_handle()), &mut process) };

    process
}

fn window_process(raw: isize) -> u32 {
    let mut process = 0;
    unsafe { GetWindowThreadProcessId(HWND(raw as _), Some(&mut process)) };

    process
}

pub fn install() -> i32 {
    match place() {
        Ok(()) => 0,
        Err(_) => 1,
    }
}

fn place() -> Result<(), String> {
    let source = std::env::current_exe().map_err(|e| e.to_string())?;
    let target = helper_path()?;
    let folder = helper_folder()?;

    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    retry(|| std::fs::copy(&source, &target).map(drop))?;

    let xml = folder.join("task.xml");

    std::fs::write(&xml, utf16(&task_xml(&target))).map_err(|e| e.to_string())?;

    let created = schtasks(&[
        OsStr::new("/create"),
        OsStr::new("/tn"),
        OsStr::new(&task_name()),
        OsStr::new("/xml"),
        xml.as_os_str(),
        OsStr::new("/f"),
    ]);

    let _ = std::fs::remove_file(&xml);

    created
}

pub fn remove() -> i32 {
    let task = task_name();

    // the uninstaller runs while Eris is still up, so stop the helper before deleting its image
    let _ = schtasks(&["/end", "/tn", &task]);
    let _ = schtasks(&["/delete", "/tn", &task, "/f"]);

    let Ok(path) = helper_path() else {
        return 1;
    };

    let gone = retry(|| std::fs::remove_file(&path)).is_ok() || delay_delete(&path);
    let _ = helper_folder().map(std::fs::remove_dir);

    i32::from(!gone)
}

// a file Eris still holds cannot be deleted now, so mark it to go on the next boot
fn delay_delete(path: &Path) -> bool {
    let wide: Vec<u16> = path.as_os_str().encode_wide().chain([0]).collect();

    unsafe {
        MoveFileExW(
            PCWSTR(wide.as_ptr()),
            PCWSTR::null(),
            MOVEFILE_DELAY_UNTIL_REBOOT,
        )
    }
    .is_ok()
}

// the previous helper holds its exe until it notices the pipe closed
fn retry(mut action: impl FnMut() -> std::io::Result<()>) -> Result<(), String> {
    let mut attempt = 0;

    loop {
        match action() {
            Err(_) if attempt < RETRIES => {
                attempt += 1;
                std::thread::sleep(RETRY);
            }
            result => return result.map_err(|e| e.to_string()),
        }
    }
}

fn task_xml(command: &Path) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>4</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{}</Command>
      <Arguments>{HOOK_ARG}</Arguments>
    </Exec>
  </Actions>
</Task>
"#,
        command.display()
    )
}

fn utf16(text: &str) -> Vec<u8> {
    [0xFEFF]
        .into_iter()
        .chain(text.encode_utf16())
        .flat_map(u16::to_le_bytes)
        .collect()
}

fn schtasks<S: AsRef<OsStr>>(args: &[S]) -> Result<(), String> {
    let program = known_folder(&FOLDERID_System)?.join("schtasks.exe");
    let status = Command::new(program)
        .args(args)
        .creation_flags(CREATE_NO_WINDOW.0)
        .output()
        .map_err(|e| e.to_string())?
        .status;

    if status.success() {
        Ok(())
    } else {
        Err(format!("schtasks exited with {status}"))
    }
}

// the task runs elevated without a prompt, so its exe must sit where only admins can write
fn helper_folder() -> Result<PathBuf, String> {
    Ok(known_folder(&FOLDERID_ProgramFiles)?.join(HELPER_NAME))
}

fn helper_path() -> Result<PathBuf, String> {
    Ok(helper_folder()?.join(format!("{HELPER_NAME}.exe")))
}

fn known_folder(id: &GUID) -> Result<PathBuf, String> {
    let path =
        unsafe { SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None) }.map_err(|e| e.to_string())?;
    let folder = unsafe { path.to_string() }
        .map(PathBuf::from)
        .map_err(|e| e.to_string());

    unsafe { CoTaskMemFree(Some(path.0 as *const _)) };

    folder
}

fn elevate(owner: HWND, arg: &str) -> Result<bool, String> {
    let exe = HSTRING::from(
        std::env::current_exe()
            .map_err(|e| e.to_string())?
            .as_os_str(),
    );
    let parameters = HSTRING::from(arg);

    let mut info = SHELLEXECUTEINFOW {
        cbSize: std::mem::size_of::<SHELLEXECUTEINFOW>() as u32,
        fMask: SEE_MASK_NOCLOSEPROCESS,
        hwnd: owner,
        lpVerb: w!("runas"),
        lpFile: PCWSTR(exe.as_ptr()),
        lpParameters: PCWSTR(parameters.as_ptr()),
        nShow: SW_HIDE.0,
        ..Default::default()
    };

    if let Err(error) = unsafe { ShellExecuteExW(&mut info) } {
        if error.code() == ERROR_CANCELLED.to_hresult() {
            return Ok(false);
        }

        return Err(error.to_string());
    }

    let mut code = 1;

    unsafe {
        WaitForSingleObject(info.hProcess, INFINITE);
        let _ = GetExitCodeProcess(info.hProcess, &mut code);
        let _ = CloseHandle(info.hProcess);
    }

    if code == 0 {
        Ok(true)
    } else {
        Err(format!("setup exited with {code}"))
    }
}

fn skip_marker(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_local_data_dir()
        .ok()
        .map(|folder| folder.join(SKIPPED))
}

fn skipped(app: &AppHandle) -> bool {
    skip_marker(app).is_some_and(|marker| marker.exists())
}

fn skip(app: &AppHandle) {
    let Some(marker) = skip_marker(app) else {
        return;
    };

    if let Some(folder) = marker.parent() {
        let _ = std::fs::create_dir_all(folder);
    }

    let _ = std::fs::write(marker, []);
}
