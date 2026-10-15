use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewWindow};

#[derive(Serialize)]
pub struct WindowEntry {
    pub hwnd: isize,
    pub title: String,
    pub process: String,
    pub pid: u32,
    pub minimized: bool,
    pub app_id: Option<String>,
    pub ancestor_executables: Vec<String>,
}

#[tauri::command(async)]
pub fn list_windows(app: AppHandle) -> Vec<WindowEntry> {
    win::list(&shell_windows(&app))
}

fn shell_windows(app: &AppHandle) -> Vec<isize> {
    let config = &app.config().app.windows;

    app.webview_windows()
        .into_iter()
        .filter(|(label, _)| {
            config
                .iter()
                .any(|window| &window.label == label && window.skip_taskbar)
        })
        .filter_map(|(_, window)| window.hwnd().ok())
        .map(|hwnd| hwnd.0 as isize)
        .collect()
}

#[tauri::command(async)]
pub fn activate_window(hwnd: isize) {
    win::activate(hwnd);
}

#[tauri::command]
pub fn close_window(hwnd: isize) {
    win::close(hwnd);
}

#[tauri::command(async)]
pub fn end_task(windows: Vec<isize>) {
    win::end_task(&windows);
}

#[tauri::command]
pub fn minimize_window(hwnd: isize) {
    win::minimize(hwnd);
}

pub fn force_foreground(window: &WebviewWindow) {
    if let Ok(hwnd) = window.hwnd() {
        win::force_foreground(hwnd.0 as isize);
    }
}

pub fn watch(app: tauri::AppHandle) {
    win::watch(app);
}

mod win {
    use std::collections::{HashMap, HashSet};
    use std::sync::mpsc::{channel, Receiver, RecvTimeoutError, Sender};
    use std::sync::{Mutex, OnceLock};
    use std::time::{Duration, Instant};

    use tauri::{AppHandle, Emitter};
    use windows::core::{BOOL, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, FILETIME, HWND, LPARAM, WAIT_TIMEOUT, WPARAM};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows::Win32::Storage::EnhancedStorage::PKEY_AppUserModel_ID;
    use windows::Win32::System::Com::CoTaskMemFree;
    use windows::Win32::System::Com::StructuredStorage::{
        PropVariantClear, PropVariantToStringAlloc,
    };
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };
    use windows::Win32::System::Threading::{
        AttachThreadInput, GetCurrentThreadId, GetProcessTimes, OpenProcess,
        QueryFullProcessImageNameW, TerminateProcess, WaitForSingleObject, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE, PROCESS_TERMINATE,
    };
    use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
    use windows::Win32::UI::Input::KeyboardAndMouse::SetFocus;
    use windows::Win32::UI::Shell::PropertiesSystem::{
        IPropertyStore, SHGetPropertyStoreForWindow,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, DispatchMessageW, EnumWindows, GetAncestor, GetClassNameW,
        GetForegroundWindow, GetLastActivePopup, GetMessageW, GetShellWindow, GetWindow,
        GetWindowLongPtrW, GetWindowTextW, GetWindowThreadProcessId, IsHungAppWindow, IsIconic,
        IsWindow, IsWindowVisible, PostMessageW, SetForegroundWindow, ShowWindowAsync,
        EVENT_OBJECT_CLOAKED, EVENT_OBJECT_CREATE, EVENT_OBJECT_HIDE, EVENT_OBJECT_NAMECHANGE,
        EVENT_OBJECT_UNCLOAKED, EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_MINIMIZEEND,
        EVENT_SYSTEM_MINIMIZESTART, GA_ROOT, GWL_EXSTYLE, GW_OWNER, MSG, SW_MINIMIZE, SW_RESTORE,
        WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS, WM_CLOSE, WS_EX_APPWINDOW,
        WS_EX_TOOLWINDOW,
    };

    use super::WindowEntry;
    use crate::system::com::Apartment;

    const HIDDEN_CLASSES: [&str; 2] = ["Progman", "Windows.UI.Core.CoreWindow"];

    fn read(hwnd: HWND, reader: unsafe fn(HWND, &mut [u16]) -> i32) -> String {
        let mut buffer = [0u16; 512];
        let length = unsafe { reader(hwnd, &mut buffer) }.max(0) as usize;

        String::from_utf16_lossy(&buffer[..length])
    }

    #[derive(Clone)]
    struct ProcessIdentity {
        path: String,
        created: u64,
    }

    fn process_identity(pid: u32) -> Option<ProcessIdentity> {
        let Ok(process) = (unsafe {
            OpenProcess(
                PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
                false,
                pid,
            )
        }) else {
            return None;
        };

        let mut buffer = [0u16; 32_768];
        let mut length = buffer.len() as u32;
        let mut created = FILETIME::default();
        let mut exited = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();

        let query = unsafe {
            QueryFullProcessImageNameW(
                process,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &mut length,
            )
        };
        let times =
            unsafe { GetProcessTimes(process, &mut created, &mut exited, &mut kernel, &mut user) };
        // GetProcessTimes' exit-time output is undefined while the process is
        // running. Only the process handle's unsignaled state proves liveness.
        let alive = unsafe { WaitForSingleObject(process, 0) } == WAIT_TIMEOUT;

        unsafe {
            let _ = CloseHandle(process);
        }

        if query.is_err() || times.is_err() || !alive {
            return None;
        }
        Some(ProcessIdentity {
            path: String::from_utf16_lossy(&buffer[..length as usize]),
            created: ((created.dwHighDateTime as u64) << 32) | created.dwLowDateTime as u64,
        })
    }

    fn process_parents() -> HashMap<u32, u32> {
        let mut parents = HashMap::new();
        unsafe {
            let Ok(snapshot) = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) else {
                return parents;
            };
            let mut entry = PROCESSENTRY32W {
                dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
                ..Default::default()
            };
            if Process32FirstW(snapshot, &mut entry).is_ok() {
                loop {
                    parents.insert(entry.th32ProcessID, entry.th32ParentProcessID);
                    if Process32NextW(snapshot, &mut entry).is_err() {
                        break;
                    }
                }
            }
            let _ = CloseHandle(snapshot);
        }
        parents
    }

    // A PID is not an identity: a dead parent may have been replaced since the
    // snapshot. Creation times must decrease along every live ancestry edge.
    fn ancestors(
        pid: u32,
        parents: &HashMap<u32, u32>,
        shell_image: Option<&str>,
        mut identity: impl FnMut(u32) -> Option<ProcessIdentity>,
    ) -> Vec<String> {
        let mut paths = Vec::new();
        let Some(mut child) = identity(pid) else {
            return paths;
        };
        let mut current = pid;
        let mut seen = HashSet::from([pid]);
        for _ in 0..16 {
            let Some(&parent) = parents.get(&current) else {
                break;
            };
            if parent == 0 || !seen.insert(parent) {
                break;
            }
            let Some(found) = identity(parent) else { break };
            if found.created >= child.created {
                break;
            }
            // The desktop shell launches unrelated apps, not just its helpers.
            // Compare its image rather than PID to cover separate shell processes.
            if shell_image.is_some_and(|shell| found.path.eq_ignore_ascii_case(shell)) {
                break;
            }
            paths.push(found.path.clone());
            child = found;
            current = parent;
        }
        paths
    }

    fn window_app_id(hwnd: HWND) -> Option<String> {
        unsafe {
            let store: IPropertyStore = SHGetPropertyStoreForWindow(hwnd).ok()?;
            let mut value = store.GetValue(&PKEY_AppUserModel_ID).ok()?;
            let text = PropVariantToStringAlloc(&value).ok();
            let _ = PropVariantClear(&mut value);
            let text = text?;
            let id = text.to_string().ok();
            CoTaskMemFree(Some(text.0 as *const _));
            id.filter(|id| !id.is_empty())
        }
    }

    fn describe(hwnd: HWND) -> Option<WindowEntry> {
        unsafe {
            if !IsWindowVisible(hwnd).as_bool() {
                return None;
            }

            let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;

            if style & WS_EX_TOOLWINDOW.0 != 0 {
                return None;
            }

            if style & WS_EX_APPWINDOW.0 == 0 && GetWindow(hwnd, GW_OWNER).is_ok() {
                return None;
            }

            let mut cloaked = 0u32;
            let _ = DwmGetWindowAttribute(
                hwnd,
                DWMWA_CLOAKED,
                &mut cloaked as *mut _ as *mut _,
                std::mem::size_of::<u32>() as u32,
            );

            if cloaked != 0 {
                return None;
            }

            let title = read(hwnd, GetWindowTextW);

            if title.is_empty() || HIDDEN_CLASSES.contains(&read(hwnd, GetClassNameW).as_str()) {
                return None;
            }

            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));

            Some(WindowEntry {
                hwnd: hwnd.0 as isize,
                title,
                process: String::new(),
                pid,
                minimized: IsIconic(hwnd).as_bool(),
                app_id: window_app_id(hwnd),
                ancestor_executables: Vec::new(),
            })
        }
    }

    unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let entries = unsafe { &mut *(lparam.0 as *mut Vec<WindowEntry>) };

        if let Some(entry) = describe(hwnd) {
            entries.push(entry);
        }

        BOOL(1)
    }

    pub fn list(shell: &[isize]) -> Vec<WindowEntry> {
        let _apartment = Apartment::enter().ok();
        let mut entries: Vec<WindowEntry> = Vec::new();

        unsafe {
            let _ = EnumWindows(Some(collect), LPARAM(&mut entries as *mut _ as isize));
        }

        entries.retain(|entry| !shell.contains(&entry.hwnd));

        // One snapshot per poll, and one handle/path/time query per relevant PID,
        // including processes which own several windows or share helper parents.
        let parents = process_parents();
        let mut identities = HashMap::new();
        let mut identity = |pid| {
            identities
                .entry(pid)
                .or_insert_with(|| process_identity(pid))
                .clone()
        };
        let mut shell_pid = 0;
        unsafe {
            GetWindowThreadProcessId(GetShellWindow(), Some(&mut shell_pid));
        }
        let shell_image = identity(shell_pid).map(|found| found.path);
        for entry in &mut entries {
            entry.process = identity(entry.pid)
                .map(|found| found.path)
                .unwrap_or_default();
            // Without a known shell boundary, don't infer unrelated launchers.
            if let Some(shell_image) = shell_image.as_deref() {
                entry.ancestor_executables =
                    ancestors(entry.pid, &parents, Some(shell_image), &mut identity);
            }
        }

        entries
    }

    const OBJID_WINDOW: i32 = 0;
    const COALESCE: Duration = Duration::from_millis(120);
    const MAX_WAIT: Duration = Duration::from_millis(800);

    static APP: OnceLock<AppHandle> = OnceLock::new();
    static CHANGES: OnceLock<Sender<()>> = OnceLock::new();
    static LAST_FOREGROUND: Mutex<Option<Instant>> = Mutex::new(None);

    // a closed window is already gone when its hide or destroy arrives, so only a live child is skipped
    fn child_window(hwnd: HWND) -> bool {
        unsafe { IsWindow(Some(hwnd)).as_bool() && GetAncestor(hwnd, GA_ROOT) != hwnd }
    }

    fn foreground_changed() {
        let mut last = LAST_FOREGROUND.lock().unwrap();
        let now = Instant::now();

        if last.is_some_and(|at| now.duration_since(at) < COALESCE) {
            return;
        }

        *last = Some(now);
        drop(last);

        if let Some(app) = APP.get() {
            let _ = app.emit("foreground-changed", ());
        }
    }

    // a burst ends with the change that matters, so wait for quiet but never longer than MAX_WAIT
    fn settle(app: AppHandle, changes: Receiver<()>) {
        while changes.recv().is_ok() {
            let first = Instant::now();

            loop {
                let left = MAX_WAIT.saturating_sub(first.elapsed());

                if left.is_zero() {
                    break;
                }

                match changes.recv_timeout(COALESCE.min(left)) {
                    Ok(()) => {}
                    Err(RecvTimeoutError::Timeout) => break,
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }

            let _ = app.emit("windows-changed", ());
        }
    }

    unsafe extern "system" fn on_event(
        _hook: HWINEVENTHOOK,
        event: u32,
        hwnd: HWND,
        id_object: i32,
        _id_child: i32,
        _thread: u32,
        _time: u32,
    ) {
        if hwnd.is_invalid() || id_object != OBJID_WINDOW {
            return;
        }

        // the taskbar is unfocusable, so dock popups learn about outside focus from here
        if event == EVENT_SYSTEM_FOREGROUND {
            foreground_changed();

            return;
        }

        if child_window(hwnd) {
            return;
        }

        if let Some(changes) = CHANGES.get() {
            let _ = changes.send(());
        }
    }

    // window lifecycle events arrive through a message loop, so the hook lives on its own thread
    pub fn watch(app: AppHandle) {
        let (sender, changes) = channel();

        let _ = CHANGES.set(sender);
        let _ = APP.set(app.clone());

        std::thread::spawn(move || settle(app, changes));

        std::thread::spawn(|| unsafe {
            let flags = WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS;

            let _hooks = [
                SetWinEventHook(
                    EVENT_SYSTEM_FOREGROUND,
                    EVENT_SYSTEM_FOREGROUND,
                    None,
                    Some(on_event),
                    0,
                    0,
                    flags,
                ),
                SetWinEventHook(
                    EVENT_OBJECT_CREATE,
                    EVENT_OBJECT_HIDE,
                    None,
                    Some(on_event),
                    0,
                    0,
                    flags,
                ),
                SetWinEventHook(
                    EVENT_OBJECT_NAMECHANGE,
                    EVENT_OBJECT_NAMECHANGE,
                    None,
                    Some(on_event),
                    0,
                    0,
                    flags,
                ),
                SetWinEventHook(
                    EVENT_OBJECT_CLOAKED,
                    EVENT_OBJECT_UNCLOAKED,
                    None,
                    Some(on_event),
                    0,
                    0,
                    flags,
                ),
                SetWinEventHook(
                    EVENT_SYSTEM_MINIMIZESTART,
                    EVENT_SYSTEM_MINIMIZEEND,
                    None,
                    Some(on_event),
                    0,
                    0,
                    flags,
                ),
            ];

            let mut message = MSG::default();

            while GetMessageW(&mut message, None, 0, 0).as_bool() {
                let _ = DispatchMessageW(&message);
            }
        });
    }

    pub fn activate(raw: isize) {
        let hwnd = HWND(raw as _);

        unsafe {
            if !IsWindow(Some(hwnd)).as_bool() {
                return;
            }
            // Activate the app's visible modal dialog rather than its blocked owner.
            let popup = GetLastActivePopup(hwnd);
            let target = if popup != hwnd && IsWindowVisible(popup).as_bool() {
                popup
            } else {
                hwnd
            };
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindowAsync(hwnd, SW_RESTORE);
            }
            if target != hwnd && IsIconic(target).as_bool() {
                let _ = ShowWindowAsync(target, SW_RESTORE);
            }
            force_foreground(target.0 as isize);
        }
    }

    pub fn minimize(raw: isize) {
        unsafe {
            let _ = ShowWindowAsync(HWND(raw as _), SW_MINIMIZE);
        }
    }

    pub fn close(raw: isize) {
        unsafe {
            let _ = PostMessageW(Some(HWND(raw as _)), WM_CLOSE, WPARAM(0), LPARAM(0));
        }
    }

    // the owning process comes from the window itself, never from the caller, and Eris never ends itself
    pub fn end_task(windows: &[isize]) {
        let own = std::process::id();
        let pids: HashSet<u32> = windows
            .iter()
            .map(|raw| {
                let mut pid = 0;

                unsafe { GetWindowThreadProcessId(HWND(*raw as _), Some(&mut pid)) };

                pid
            })
            .filter(|pid| *pid != 0 && *pid != own)
            .collect();

        for pid in pids {
            if let Ok(process) = unsafe { OpenProcess(PROCESS_TERMINATE, false, pid) } {
                unsafe {
                    let _ = TerminateProcess(process, 1);
                    let _ = CloseHandle(process);
                }
            }
        }
    }

    pub fn force_foreground(raw: isize) {
        let hwnd = HWND(raw as _);

        unsafe {
            let me = GetCurrentThreadId();
            let front_window = GetForegroundWindow();
            let front = GetWindowThreadProcessId(front_window, None);
            let attached = front != 0
                && front != me
                && !IsHungAppWindow(front_window).as_bool()
                && AttachThreadInput(me, front, true).as_bool();

            let _ = BringWindowToTop(hwnd);
            let _ = SetForegroundWindow(hwnd);
            let _ = SetFocus(Some(hwnd));

            if attached {
                let _ = AttachThreadInput(me, front, false);
            }
        }
    }

    #[cfg(test)]
    mod ancestry_tests {
        use super::*;

        #[test]
        fn only_live_processes_supply_identity() {
            use std::os::windows::process::CommandExt;
            use windows::Win32::System::Threading::CREATE_NO_WINDOW;

            assert!(process_identity(std::process::id()).is_some());
            let mut child = std::process::Command::new(std::env::current_exe().unwrap())
                .arg("--list")
                .stdout(std::process::Stdio::null())
                .creation_flags(CREATE_NO_WINDOW.0)
                .spawn()
                .unwrap();
            child.wait().unwrap();
            assert!(process_identity(child.id()).is_none());
        }

        fn identity(pid: u32) -> Option<ProcessIdentity> {
            Some(ProcessIdentity {
                path: format!("{pid}.exe"),
                created: pid as u64,
            })
        }

        #[test]
        fn follows_live_older_parents() {
            let parents = HashMap::from([(3, 2), (2, 1)]);
            assert_eq!(ancestors(3, &parents, None, identity), ["2.exe", "1.exe"]);
        }

        #[test]
        fn rejects_recycled_parent_pids_and_missing_processes() {
            assert!(ancestors(2, &HashMap::from([(2, 3)]), None, identity).is_empty());
            assert!(ancestors(3, &HashMap::from([(3, 2)]), None, |pid| {
                if pid == 2 {
                    None
                } else {
                    identity(pid)
                }
            })
            .is_empty());
        }

        #[test]
        fn stops_cycles_and_bounds_depth() {
            assert_eq!(
                ancestors(3, &HashMap::from([(3, 2), (2, 3)]), None, identity),
                ["2.exe"]
            );
            let parents = (2..=30).map(|pid| (pid, pid - 1)).collect();
            assert_eq!(ancestors(30, &parents, None, identity).len(), 16);
        }

        #[test]
        fn the_desktop_shell_is_not_inherited_as_an_app_launcher() {
            let parents = HashMap::from([(3, 2), (2, 1)]);
            assert_eq!(ancestors(3, &parents, Some("1.EXE"), identity), ["2.exe"]);
            assert!(ancestors(2, &parents, Some("1.exe"), identity).is_empty());
            // Another process with the shell's executable is the same boundary.
            assert!(ancestors(3, &parents, Some("shell.exe"), |pid| {
                let mut found = identity(pid)?;
                if pid == 2 {
                    found.path = "SHELL.exe".into();
                }
                Some(found)
            })
            .is_empty());
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn lists_visible_windows() {
        let windows = super::win::list(&[]);

        assert!(!windows.is_empty(), "no top-level windows found");
        assert!(windows.iter().all(|entry| !entry.title.is_empty()));
    }
}
