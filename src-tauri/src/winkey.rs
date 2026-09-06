use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::Instant;

const LONE_LIMIT: u64 = 3_000;
const HOLD_LIMIT: u64 = 5_000;
const LWIN_BIT: u8 = 1;
const RWIN_BIT: u8 = 2;

static CAPTURE: AtomicBool = AtomicBool::new(false);
static KEYS: Mutex<Keys> = Mutex::new(Keys::IDLE);

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
        now.saturating_sub(self.since) >= LONE_LIMIT
    }

    // the win down never reaches the os, so the key state cannot confirm the hold: age it out instead
    fn expired(self, now: u64) -> bool {
        now.saturating_sub(self.since) >= HOLD_LIMIT
    }

    fn win_down(self, bit: u8, now: u64) -> Self {
        if self.expired(now) || self.mask == 0 {
            return Self {
                mask: bit,
                since: now,
                combo: false,
            };
        }

        if self.mask & bit != 0 {
            return self;
        }

        Self {
            mask: self.mask | bit,
            ..self
        }
    }

    fn other_down(self, now: u64) -> (Self, bool) {
        if self.mask == 0 {
            return (self, false);
        }

        if self.expired(now) {
            return (Self::IDLE, false);
        }

        if self.combo {
            return (self, false);
        }

        (
            Self {
                combo: true,
                ..self
            },
            true,
        )
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

fn now() -> u64 {
    static ORIGIN: OnceLock<Instant> = OnceLock::new();

    ORIGIN.get_or_init(Instant::now).elapsed().as_millis() as u64
}

#[tauri::command]
pub fn set_win_key_capture(enabled: bool) {
    CAPTURE.store(enabled, Ordering::Relaxed);
    *KEYS.lock().unwrap() = Keys::IDLE;
    release();
}

#[cfg(target_os = "windows")]
pub use win::{chord, install, release, tap};

#[cfg(not(target_os = "windows"))]
pub fn install(_app: tauri::AppHandle) {}

#[cfg(not(target_os = "windows"))]
pub fn chord<T>(_keys: &[T]) {}

#[cfg(not(target_os = "windows"))]
pub fn tap<T>(_key: T) {}

#[cfg(not(target_os = "windows"))]
pub fn release() {}

#[cfg(target_os = "windows")]
mod win {
    use std::sync::atomic::{AtomicU16, Ordering};
    use std::sync::mpsc::{sync_channel, SyncSender};
    use std::sync::OnceLock;

    use tauri::AppHandle;
    use windows::Win32::Foundation::{LPARAM, LRESULT, WPARAM};
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
        KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, VIRTUAL_KEY, VK_LWIN, VK_RWIN,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, DispatchMessageW, GetMessageW, SetWindowsHookExW, TranslateMessage,
        UnhookWindowsHookEx, KBDLLHOOKSTRUCT, LLKHF_EXTENDED, MSG, WH_KEYBOARD_LL, WM_KEYDOWN,
        WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    use super::{now, WinUp, CAPTURE, KEYS, LWIN_BIT, RWIN_BIT};

    const TAG: usize = 0x4552_4953;
    const RELEASE_TRIES: usize = 2;

    static EVENTS: OnceLock<SyncSender<()>> = OnceLock::new();
    static OPEN_KEY: AtomicU16 = AtomicU16::new(0);

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

    fn win_key(mask: u8) -> VIRTUAL_KEY {
        if mask & LWIN_BIT != 0 {
            VK_LWIN
        } else {
            VK_RWIN
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
    fn open_combo(win: VIRTUAL_KEY, event: &KBDLLHOOKSTRUCT) -> bool {
        let inputs = [
            stroke(win, 0, KEYEVENTF_EXTENDEDKEY),
            stroke(
                VIRTUAL_KEY(event.vkCode as u16),
                event.scanCode as u16,
                event_flags(event, KEYBD_EVENT_FLAGS(0)),
            ),
        ];

        OPEN_KEY.store(win.0, Ordering::Relaxed);

        if send(&inputs) == inputs.len() as u32 {
            return true;
        }

        release();

        false
    }

    // UIPI drops an injection without saying so in the return value, so confirm the key came back up
    pub fn release() {
        let vk = OPEN_KEY.load(Ordering::Relaxed);

        if vk == 0 {
            return;
        }

        let key = VIRTUAL_KEY(vk);

        for _ in 0..RELEASE_TRIES {
            send(&[stroke(key, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP)]);

            if !key_down(key) {
                OPEN_KEY.store(0, Ordering::Relaxed);

                return;
            }
        }

        crate::trace("injected win key is still down after release");
    }

    // hook callbacks must return within LowLevelHooksTimeout, so only hand off here
    fn notify() {
        if let Some(sender) = EVENTS.get() {
            let _ = sender.try_send(());
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
                let next = keys.win_down(bit, stamp);
                let dropped = keys.combo && !next.combo;

                *keys = next;
                drop(keys);

                if dropped {
                    release();
                }

                return LRESULT(1);
            }
            WM_KEYDOWN | WM_SYSKEYDOWN => {
                let mut keys = KEYS.lock().unwrap();
                let (next, opening) = keys.other_down(stamp);

                if !opening {
                    let dropped = keys.combo && !next.combo;

                    *keys = next;
                    drop(keys);

                    if dropped {
                        release();
                    }
                } else {
                    *keys = next;

                    let opened = open_combo(win_key(next.mask), event);

                    drop(keys);

                    if opened {
                        return LRESULT(1);
                    }
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
                        release();

                        return LRESULT(1);
                    }
                    WinUp::Lone => {
                        notify();

                        return LRESULT(1);
                    }
                }
            }
            _ => {}
        }

        unsafe { CallNextHookEx(None, code, wparam, lparam) }
    }

    pub fn install(app: AppHandle) {
        let (sender, receiver) = sync_channel(4);
        let _ = EVENTS.set(sender);

        std::thread::spawn(move || {
            while receiver.recv().is_ok() {
                crate::windowing::toggle(&app, "main");
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
    use super::{Keys, WinUp, HOLD_LIMIT, LONE_LIMIT, LWIN_BIT, RWIN_BIT};

    const BOTH: u8 = LWIN_BIT | RWIN_BIT;

    #[test]
    fn a_lone_win_tap_is_lone() {
        let keys = Keys::IDLE.win_down(LWIN_BIT, 100);
        let (next, action) = keys.win_up(LWIN_BIT, 180);

        assert_eq!(action, WinUp::Lone);
        assert_eq!(
            next,
            Keys {
                mask: 0,
                since: 100,
                combo: false
            }
        );
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
    fn auto_repeat_never_re_anchors_the_hold() {
        let mut keys = Keys::IDLE.win_down(LWIN_BIT, 0);

        for stamp in (33..LONE_LIMIT + 33).step_by(33) {
            keys = keys.win_down(LWIN_BIT, stamp);
        }

        assert_eq!(keys.since, 0);

        let (_, action) = keys.win_up(LWIN_BIT, LONE_LIMIT + 66);

        assert_eq!(action, WinUp::Swallow);
    }

    #[test]
    fn a_hold_past_the_tap_window_still_opens_a_combo() {
        let keys = Keys::IDLE.win_down(LWIN_BIT, 0);
        let (keys, opening) = keys.other_down(LONE_LIMIT + 500);

        assert!(opening);

        let (_, action) = keys.win_up(LWIN_BIT, LONE_LIMIT + 800);

        assert_eq!(action, WinUp::Release);
    }

    #[test]
    fn a_hold_we_lost_the_up_for_never_opens_a_combo() {
        let keys = Keys::IDLE.win_down(LWIN_BIT, 0);
        let (keys, opening) = keys.other_down(HOLD_LIMIT);

        assert!(!opening);
        assert_eq!(keys, Keys::IDLE);
    }

    #[test]
    fn an_expired_hold_restarts_on_the_next_win_down() {
        let keys = Keys::IDLE.win_down(LWIN_BIT, 0);
        let (keys, _) = keys.other_down(120);

        assert!(keys.combo);

        let keys = keys.win_down(LWIN_BIT, HOLD_LIMIT);

        assert_eq!(
            keys,
            Keys {
                mask: LWIN_BIT,
                since: HOLD_LIMIT,
                combo: false
            }
        );
    }

    #[test]
    fn the_second_win_key_keeps_the_first_one_held() {
        let keys = Keys::IDLE.win_down(LWIN_BIT, 100).win_down(RWIN_BIT, 120);

        assert_eq!(keys.mask, BOTH);
        assert_eq!(keys.since, 100);

        let (keys, first) = keys.win_up(LWIN_BIT, 200);
        let (_, second) = keys.win_up(RWIN_BIT, 220);

        assert_eq!(first, WinUp::Swallow);
        assert_eq!(second, WinUp::Lone);
    }
}
