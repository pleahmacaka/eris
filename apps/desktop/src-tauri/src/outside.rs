use tauri::AppHandle;

pub fn watch(app: &AppHandle, on: bool) {
    win::watch(app, on);
}

#[cfg(target_os = "windows")]
mod win {
    use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
    use std::sync::mpsc::{sync_channel, SyncSender};
    use std::sync::OnceLock;

    use tauri::{AppHandle, Emitter};
    use windows::Win32::Foundation::{LPARAM, LRESULT, POINT, WPARAM};
    use windows::Win32::System::Threading::{GetCurrentProcessId, GetCurrentThreadId};
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetAncestor, GetMessageW, GetWindowThreadProcessId,
        PeekMessageW, PostThreadMessageW, SetWindowsHookExW, UnhookWindowsHookEx, WindowFromPoint,
        GA_ROOT, MSG, MSLLHOOKSTRUCT, PM_NOREMOVE, WH_MOUSE_LL, WM_APP, WM_LBUTTONDOWN,
        WM_MBUTTONDOWN, WM_RBUTTONDOWN, WM_XBUTTONDOWN,
    };

    const RECONCILE: u32 = WM_APP + 1;

    static WANT: AtomicBool = AtomicBool::new(false);
    static THREAD: AtomicU32 = AtomicU32::new(0);
    static PRESSES: OnceLock<SyncSender<POINT>> = OnceLock::new();

    pub fn watch(app: &AppHandle, on: bool) {
        if WANT.swap(on, Ordering::SeqCst) == on {
            return;
        }

        PRESSES.get_or_init(|| start(app.clone()));

        let thread = THREAD.load(Ordering::SeqCst);

        if thread != 0 {
            unsafe {
                let _ = PostThreadMessageW(thread, RECONCILE, WPARAM(0), LPARAM(0));
            }
        }
    }

    fn start(app: AppHandle) -> SyncSender<POINT> {
        let (sender, receiver) = sync_channel::<POINT>(8);

        std::thread::spawn(move || {
            while let Ok(point) = receiver.recv() {
                if WANT.load(Ordering::SeqCst) && !ours(point) {
                    let _ = app.emit("eris-close-menus", ());
                }
            }
        });

        std::thread::spawn(|| unsafe {
            let mut message = MSG::default();
            let mut hook = None;

            // a thread message posted before the queue exists is dropped
            let _ = PeekMessageW(&mut message, None, 0, 0, PM_NOREMOVE);
            THREAD.store(GetCurrentThreadId(), Ordering::SeqCst);

            loop {
                match (WANT.load(Ordering::SeqCst), hook) {
                    (true, None) => {
                        hook = SetWindowsHookExW(WH_MOUSE_LL, Some(press), None, 0).ok();
                    }
                    (false, Some(installed)) => {
                        let _ = UnhookWindowsHookEx(installed);
                        hook = None;
                    }
                    _ => {}
                }

                if !GetMessageW(&mut message, None, 0, 0).as_bool() {
                    break;
                }

                DispatchMessageW(&message);
            }
        });

        sender
    }

    // the webview's child window belongs to msedgewebview2.exe, so judge the root window
    fn ours(point: POINT) -> bool {
        let mut pid = 0u32;

        unsafe {
            let root = GetAncestor(WindowFromPoint(point), GA_ROOT);

            GetWindowThreadProcessId(root, Some(&mut pid));

            pid == GetCurrentProcessId()
        }
    }

    unsafe extern "system" fn press(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        let down = matches!(
            wparam.0 as u32,
            WM_LBUTTONDOWN | WM_RBUTTONDOWN | WM_MBUTTONDOWN | WM_XBUTTONDOWN
        );

        if code >= 0 && down {
            let info = unsafe { &*(lparam.0 as *const MSLLHOOKSTRUCT) };

            if let Some(presses) = PRESSES.get() {
                let _ = presses.try_send(info.pt);
            }
        }

        unsafe { CallNextHookEx(None, code, wparam, lparam) }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use tauri::AppHandle;

    pub fn watch(_app: &AppHandle, _on: bool) {}
}
