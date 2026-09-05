use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

const HELD_TIMEOUT: u64 = 3_000;
const LONE_WINDOW: u64 = 1_200;
const COMBO_GUARD: u64 = 1_500;
const LWIN_BIT: u8 = 1;
const RWIN_BIT: u8 = 2;

static CAPTURE: AtomicBool = AtomicBool::new(false);
static KEYS: Mutex<Keys> = Mutex::new(Keys::IDLE);
static LAST_COMBO: AtomicU64 = AtomicU64::new(0);
static LAST_LONE: AtomicU64 = AtomicU64::new(0);

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
struct Keys {
    mask: u8,
    since: u64,
    combo: bool,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum WinUp {
    Pass,
    Swallow,
    Lone,
    Release,
}

impl Keys {
    const IDLE: Self = Self {
        mask: 0,
        since: 0,
        combo: false,
    };

    fn stale(self, now: u64) -> bool {
        now.saturating_sub(self.since) >= HELD_TIMEOUT
    }

    fn win_down(self, bit: u8, now: u64) -> Self {
        if self.mask == 0 || (self.stale(now) && !self.combo) {
            return Self {
                mask: bit,
                since: now,
                combo: false,
            };
        }

        Self {
            mask: self.mask | bit,
            ..self
        }
    }

    fn other_down(self, now: u64) -> (Self, bool) {
        if self.mask == 0 || self.combo || self.stale(now) {
            return (self, false);
        }

        (Self { combo: true, ..self }, true)
    }

    fn win_up(self, bit: u8, now: u64) -> (Self, WinUp) {
        if self.mask & bit == 0 {
            return (self, WinUp::Pass);
        }

        let mask = self.mask & !bit;

        let action = if mask != 0 {
            WinUp::Swallow
        } else if self.combo {
            WinUp::Release
        } else if self.stale(now) {
            WinUp::Swallow
        } else {
            WinUp::Lone
        };

        let next = Self {
            mask,
            since: self.since,
            combo: self.combo && mask != 0,
        };

        (next, action)
    }
}

fn fresh(stamp: u64, now: u64, window: u64) -> bool {
    stamp != 0 && now.saturating_sub(stamp) < window
}

fn fallback_due(now: u64, last_lone: u64, last_combo: u64) -> bool {
    fresh(last_lone, now, LONE_WINDOW) && !fresh(last_combo, now, COMBO_GUARD)
}

fn now() -> u64 {
    static ORIGIN: OnceLock<Instant> = OnceLock::new();

    ORIGIN.get_or_init(Instant::now).elapsed().as_millis() as u64
}

#[tauri::command]
pub fn set_win_key_capture(enabled: bool) {
    CAPTURE.store(enabled, Ordering::Relaxed);
    *KEYS.lock().unwrap() = Keys::IDLE;
    LAST_LONE.store(0, Ordering::Relaxed);
    LAST_COMBO.store(0, Ordering::Relaxed);
}

#[cfg(target_os = "windows")]
pub use win::{chord, install, tap};

#[cfg(not(target_os = "windows"))]
pub fn install(_app: tauri::AppHandle) {}

#[cfg(not(target_os = "windows"))]
pub fn chord<T>(_keys: &[T]) {}

#[cfg(target_os = "windows")]
mod win {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::mpsc::{sync_channel, SyncSender};
    use std::sync::OnceLock;

    use tauri::AppHandle;
    use windows::core::PWSTR;
    use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
        KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_CONTROL, VK_ESCAPE, VK_LWIN,
        VK_RWIN,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetForegroundWindow, GetMessageW,
        GetWindowThreadProcessId, SetWindowsHookExW, TranslateMessage, UnhookWindowsHookEx,
        EVENT_SYSTEM_FOREGROUND, KBDLLHOOKSTRUCT, LLKHF_EXTENDED, MSG, WH_KEYBOARD_LL,
        WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN,
        WM_SYSKEYUP,
    };

    use super::{fallback_due, now, WinUp, CAPTURE, KEYS, LAST_COMBO, LAST_LONE, LWIN_BIT, RWIN_BIT};

    const TAG: usize = 0x4552_4953;
    const SHELL_UI: [&str; 2] = ["StartMenuExperienceHost.exe", "SearchHost.exe"];

    static PRESSED: [AtomicBool; 256] = [const { AtomicBool::new(false) }; 256];

    #[derive(Clone, Copy)]
    enum Event {
        Toggle,
        ShellUi,
    }

    static EVENTS: OnceLock<SyncSender<Event>> = OnceLock::new();

    fn stroke(key: VIRTUAL_KEY, scan: u16, flags: KEYBD_EVENT_FLAGS) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: key,
                    wScan: scan,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: TAG,
                },
            },
        }
    }

    fn send(inputs: &[INPUT]) -> u32 {
        unsafe { SendInput(inputs, std::mem::size_of::<INPUT>() as i32) }
    }

    pub fn tap(key: VIRTUAL_KEY) {
        send(&[
            stroke(key, 0, KEYBD_EVENT_FLAGS(0)),
            stroke(key, 0, KEYEVENTF_KEYUP),
        ]);
    }

    pub fn chord(keys: &[VIRTUAL_KEY]) {
        let mut inputs: Vec<INPUT> = keys
            .iter()
            .map(|key| stroke(*key, 0, KEYBD_EVENT_FLAGS(0)))
            .collect();

        inputs.extend(
            keys.iter()
                .rev()
                .map(|key| stroke(*key, 0, KEYEVENTF_KEYUP)),
        );

        send(&inputs);
    }

    fn key_down(key: VIRTUAL_KEY) -> bool {
        unsafe { GetAsyncKeyState(key.0 as i32) as u16 & 0x8000 != 0 }
    }

    fn win_bit(key: VIRTUAL_KEY) -> u8 {
        if key == VK_LWIN {
            LWIN_BIT
        } else if key == VK_RWIN {
            RWIN_BIT
        } else {
            0
        }
    }

    fn repeated(vk: u32) -> bool {
        PRESSED
            .get(vk as usize)
            .is_some_and(|slot| slot.swap(true, Ordering::Relaxed))
    }

    fn released(vk: u32) {
        if let Some(slot) = PRESSED.get(vk as usize) {
            slot.store(false, Ordering::Relaxed);
        }
    }

    fn event_flags(event: &KBDLLHOOKSTRUCT, base: KEYBD_EVENT_FLAGS) -> KEYBD_EVENT_FLAGS {
        if event.flags.0 & LLKHF_EXTENDED.0 == 0 {
            base
        } else {
            base | KEYEVENTF_EXTENDEDKEY
        }
    }

    // the shell opens Start on a win key it saw go down, so hand it the down only once a combo needs it
    fn open_combo(event: &KBDLLHOOKSTRUCT) -> bool {
        let inputs = [
            stroke(VK_LWIN, 0, KEYEVENTF_EXTENDEDKEY),
            stroke(
                VIRTUAL_KEY(event.vkCode as u16),
                event.scanCode as u16,
                event_flags(event, KEYBD_EVENT_FLAGS(0)),
            ),
        ];

        send(&inputs) == inputs.len() as u32
    }

    fn close_combo() {
        send(&[stroke(
            VK_LWIN,
            0,
            KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP,
        )]);
    }

    // ponytail: hook callbacks must return within LowLevelHooksTimeout, so only hand off here
    fn notify(event: Event) {
        if let Some(sender) = EVENTS.get() {
            let _ = sender.try_send(event);
        }
    }

    unsafe extern "system" fn keyboard_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code < 0 || !CAPTURE.load(Ordering::Relaxed) {
            return unsafe { CallNextHookEx(None, code, wparam, lparam) };
        }

        let event = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };

        if event.dwExtraInfo == TAG {
            return unsafe { CallNextHookEx(None, code, wparam, lparam) };
        }

        let key = VIRTUAL_KEY(event.vkCode as u16);
        let bit = win_bit(key);
        let stamp = now();

        match wparam.0 as u32 {
            WM_KEYDOWN | WM_SYSKEYDOWN if bit != 0 => {
                let mut keys = KEYS.lock().unwrap();

                *keys = keys.win_down(bit, stamp);

                return LRESULT(1);
            }
            WM_KEYDOWN | WM_SYSKEYDOWN => {
                if repeated(event.vkCode) {
                    return unsafe { CallNextHookEx(None, code, wparam, lparam) };
                }

                let mut keys = KEYS.lock().unwrap();
                let (next, opening) = keys.other_down(stamp);

                *keys = next;
                drop(keys);

                if next.combo || (key == VK_ESCAPE && key_down(VK_CONTROL)) {
                    LAST_COMBO.store(stamp, Ordering::Relaxed);
                }

                if opening && open_combo(event) {
                    return LRESULT(1);
                }
            }
            WM_KEYUP | WM_SYSKEYUP if bit != 0 => {
                let mut keys = KEYS.lock().unwrap();
                let (next, action) = keys.win_up(bit, stamp);

                *keys = next;
                drop(keys);

                match action {
                    WinUp::Pass => {}
                    WinUp::Swallow => return LRESULT(1),
                    WinUp::Release => {
                        close_combo();

                        return LRESULT(1);
                    }
                    WinUp::Lone => {
                        arm_fallback();
                        LAST_LONE.store(stamp, Ordering::Relaxed);
                        notify(Event::Toggle);

                        return LRESULT(1);
                    }
                }
            }
            WM_KEYUP | WM_SYSKEYUP => released(event.vkCode),
            _ => {}
        }

        unsafe { CallNextHookEx(None, code, wparam, lparam) }
    }

    fn process_name(hwnd: HWND) -> String {
        let mut pid = 0u32;

        unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };

        let Ok(process) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) })
        else {
            return String::new();
        };

        let mut buffer = [0u16; 1024];
        let mut length = buffer.len() as u32;

        let query = unsafe {
            QueryFullProcessImageNameW(
                process,
                PROCESS_NAME_WIN32,
                PWSTR(buffer.as_mut_ptr()),
                &mut length,
            )
        };

        unsafe {
            let _ = CloseHandle(process);
        }

        if query.is_err() {
            return String::new();
        }

        let path = String::from_utf16_lossy(&buffer[..length as usize]);

        path.rsplit('\\').next().unwrap_or_default().to_string()
    }

    fn is_shell(hwnd: HWND) -> bool {
        let name = process_name(hwnd);

        SHELL_UI
            .iter()
            .any(|shell| name.eq_ignore_ascii_case(shell))
    }

    // armed here so it stays off until capture is on, and this thread is the one pumping messages
    fn arm_fallback() {
        static ARMED: OnceLock<()> = OnceLock::new();

        if ARMED.set(()).is_err() {
            return;
        }

        unsafe {
            SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND,
                EVENT_SYSTEM_FOREGROUND,
                None,
                Some(foreground_hook),
                0,
                0,
                WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
            )
        };
    }

    // ponytail: a tap the hook never sees still reaches the shell, so foreground changes are the fallback
    unsafe extern "system" fn foreground_hook(
        _hook: HWINEVENTHOOK,
        _event: u32,
        hwnd: HWND,
        _object: i32,
        _child: i32,
        _thread: u32,
        _time: u32,
    ) {
        if !CAPTURE.load(Ordering::Relaxed) {
            return;
        }

        let due = fallback_due(
            now(),
            LAST_LONE.load(Ordering::Relaxed),
            LAST_COMBO.load(Ordering::Relaxed),
        );

        if !due || !is_shell(hwnd) {
            return;
        }

        LAST_LONE.store(0, Ordering::Relaxed);
        notify(Event::ShellUi);
    }

    fn handle(app: &AppHandle, event: Event) {
        match event {
            Event::Toggle => {
                crate::trace("toggle");
                crate::windowing::toggle(app, "main");
            }
            Event::ShellUi => {
                if is_shell(unsafe { GetForegroundWindow() }) {
                    tap(VK_ESCAPE);
                }

                crate::trace("shell ui dismissed");
                crate::windowing::show(app, "main");
            }
        }
    }

    pub fn install(app: AppHandle) {
        let (sender, receiver) = sync_channel(4);
        let _ = EVENTS.set(sender);

        std::thread::spawn(move || {
            while let Ok(event) = receiver.recv() {
                handle(&app, event);
            }
        });

        std::thread::spawn(|| unsafe {
            let hook = match SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook), None, 0) {
                Ok(handle) => handle,
                Err(error) => {
                    crate::trace(&format!("keyboard hook failed: {error}"));

                    return;
                }
            };

            crate::trace("hook installed");

            let mut message = MSG::default();

            while GetMessageW(&mut message, None, 0, 0).as_bool() {
                let _ = TranslateMessage(&message);
                DispatchMessageW(&message);
            }

            let _ = UnhookWindowsHookEx(hook);
        });
    }
}

#[cfg(test)]
mod tests {
    use super::{fallback_due, Keys, WinUp, COMBO_GUARD, HELD_TIMEOUT, LONE_WINDOW, LWIN_BIT, RWIN_BIT};

    #[test]
    fn a_lone_win_tap_is_lone() {
        let keys = Keys::IDLE.win_down(LWIN_BIT, 100);
        let (next, action) = keys.win_up(LWIN_BIT, 180);

        assert_eq!(action, WinUp::Lone);
        assert_eq!(next.mask, 0);
        assert!(!next.combo);
    }

    #[test]
    fn a_key_while_win_is_held_opens_the_combo_once() {
        let keys = Keys::IDLE.win_down(LWIN_BIT, 100);
        let (keys, opening) = keys.other_down(120);

        assert!(opening);
        assert!(keys.combo);

        let (keys, again) = keys.other_down(140);

        assert!(!again);

        let (next, action) = keys.win_up(LWIN_BIT, 180);

        assert_eq!(action, WinUp::Release);
        assert!(!next.combo);
    }

    #[test]
    fn a_key_without_win_never_opens_a_combo() {
        let (keys, opening) = Keys::IDLE.other_down(120);

        assert!(!opening);
        assert_eq!(keys, Keys::IDLE);
    }

    #[test]
    fn a_win_up_we_never_saw_the_down_for_passes_through() {
        let (_, action) = Keys::IDLE.win_up(LWIN_BIT, 100);

        assert_eq!(action, WinUp::Pass);
    }

    #[test]
    fn held_state_expires_so_a_later_key_is_not_a_combo() {
        let keys = Keys::IDLE.win_down(LWIN_BIT, 0);

        assert!(!keys.other_down(HELD_TIMEOUT).1);
        assert_eq!(keys.win_down(LWIN_BIT, HELD_TIMEOUT).since, HELD_TIMEOUT);

        let (_, action) = keys.win_up(LWIN_BIT, HELD_TIMEOUT);

        assert_eq!(action, WinUp::Swallow);
    }

    #[test]
    fn an_open_combo_outlives_the_timeout_so_the_win_key_is_released() {
        let keys = Keys::IDLE.win_down(LWIN_BIT, 0);
        let (keys, _) = keys.other_down(120);
        let (_, action) = keys.win_up(LWIN_BIT, HELD_TIMEOUT * 2);

        assert_eq!(action, WinUp::Release);
    }

    #[test]
    fn both_win_keys_produce_one_lone_up() {
        let keys = Keys::IDLE.win_down(LWIN_BIT, 100).win_down(RWIN_BIT, 120);
        let (keys, first) = keys.win_up(LWIN_BIT, 200);
        let (keys, second) = keys.win_up(RWIN_BIT, 220);

        assert_eq!(first, WinUp::Swallow);
        assert_eq!(second, WinUp::Lone);
        assert_eq!(keys.mask, 0);
    }

    #[test]
    fn the_fallback_needs_a_recent_lone_up_and_no_recent_combo() {
        let now = 10_000;

        assert!(fallback_due(now, now - 900, 0));
        assert!(!fallback_due(now, 0, 0));
        assert!(!fallback_due(now, now - LONE_WINDOW, 0));
        assert!(!fallback_due(now, now - 900, now - COMBO_GUARD + 1));
        assert!(fallback_due(now, now - 900, now - COMBO_GUARD));
    }
}
