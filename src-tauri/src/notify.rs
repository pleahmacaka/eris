use serde::Serialize;
use tauri::AppHandle;

#[derive(Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayIcon {
    pub id: String,
    pub tooltip: String,
    pub icon: Option<String>,
    pub hidden: bool,
}

#[tauri::command]
pub fn notify_icons() -> Vec<TrayIcon> {
    win::icons()
}

#[tauri::command]
pub fn notify_icon_click(id: String, button: String) {
    win::click(&id, &button);
}

pub fn host(app: AppHandle) {
    win::host(Some(app));
}

pub fn release() {
    win::release();
}

#[cfg(target_os = "windows")]
mod win {
    use std::sync::{Mutex, OnceLock};
    use std::thread::JoinHandle;

    use tauri::{AppHandle, Emitter};
    use windows::core::w;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
    use windows::Win32::System::DataExchange::COPYDATASTRUCT;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetCursorPos, GetMessageW, IsWindow,
        SendMessageTimeoutW, SMTO_ABORTIFHUNG,
        PostMessageW, PostQuitMessage, RegisterClassExW, RegisterWindowMessageW,
        SendNotifyMessageW, SetForegroundWindow, SetWindowPos, HWND_BROADCAST, HWND_TOPMOST, MSG,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, WM_CLOSE, WM_COPYDATA, WM_CONTEXTMENU,
        WM_DESTROY, WM_LBUTTONDOWN, WM_LBUTTONUP, WM_RBUTTONDOWN, WM_RBUTTONUP, WNDCLASSEXW,
        WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP,
    };

    use super::TrayIcon;

    const COPYDATA_TRAY: usize = 1;
    const TRAY_SIGNATURE: u32 = 0x3475_3423;
    const RELAY_TIMEOUT: u32 = 2_000;
    const NIM_ADD: u32 = 0;
    const NIM_MODIFY: u32 = 1;
    const NIM_DELETE: u32 = 2;
    const NIM_SETVERSION: u32 = 4;
    const NIF_MESSAGE: u32 = 0x01;
    const NIF_ICON: u32 = 0x02;
    const NIF_TIP: u32 = 0x04;
    const NIF_STATE: u32 = 0x08;
    const NIF_GUID: u32 = 0x20;
    const NIS_HIDDEN: u32 = 0x01;

    static APP: OnceLock<AppHandle> = OnceLock::new();
    static ENTRIES: Mutex<Vec<Entry>> = Mutex::new(Vec::new());
    static HOST: Mutex<Option<(isize, JoinHandle<()>)>> = Mutex::new(None);
    static PUBLISHED: Mutex<Vec<TrayIcon>> = Mutex::new(Vec::new());

    #[repr(C)]
    struct TrayMessage {
        signature: u32,
        action: u32,
        icon: IconData,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct IconData {
        size: u32,
        hwnd: u32,
        id: u32,
        flags: u32,
        callback: u32,
        icon: u32,
        tip: [u16; 128],
        state: u32,
        state_mask: u32,
        info: [u16; 256],
        version: u32,
        info_title: [u16; 64],
        info_flags: u32,
        guid: [u8; 16],
        balloon_icon: u32,
    }

    struct Incoming {
        hwnd: isize,
        id: u32,
        flags: u32,
        callback: u32,
        icon: isize,
        tooltip: String,
        state: u32,
        state_mask: u32,
        version: u32,
        guid: [u8; 16],
    }

    impl IconData {
        fn incoming(&self) -> Incoming {
            Incoming {
                hwnd: self.hwnd as isize,
                id: self.id,
                flags: self.flags,
                callback: self.callback,
                icon: self.icon as isize,
                tooltip: text(&self.tip),
                state: self.state,
                state_mask: self.state_mask,
                version: self.version,
                guid: self.guid,
            }
        }
    }

    struct Entry {
        hwnd: isize,
        id: u32,
        guid: [u8; 16],
        callback: u32,
        version: u32,
        tooltip: String,
        icon: isize,
        png: Option<String>,
        hidden: bool,
    }

    impl Entry {
        fn key(&self) -> String {
            key_of(self.hwnd, self.id, &self.guid)
        }

        fn alive(&self) -> bool {
            unsafe { IsWindow(Some(HWND(self.hwnd as _))) }.as_bool()
        }
    }

    fn key_of(hwnd: isize, id: u32, guid: &[u8; 16]) -> String {
        if guid.iter().any(|byte| *byte != 0) {
            return guid.iter().map(|byte| format!("{byte:02x}")).collect();
        }

        format!("{hwnd:x}:{id}")
    }

    fn text(chars: &[u16]) -> String {
        let end = chars.iter().position(|c| *c == 0).unwrap_or(chars.len());

        String::from_utf16_lossy(&chars[..end])
    }

    fn read(data: &COPYDATASTRUCT) -> Option<(u32, Incoming)> {
        if (data.cbData as usize) < std::mem::size_of::<TrayMessage>() {
            return None;
        }

        let message = unsafe { std::ptr::read_unaligned(data.lpData as *const TrayMessage) };

        if message.signature != TRAY_SIGNATURE {
            return None;
        }

        Some((message.action, message.icon.incoming()))
    }

    fn apply(action: u32, incoming: Incoming) {
        let mut entries = ENTRIES.lock().unwrap();
        let key = key_of(incoming.hwnd, incoming.id, &incoming.guid);
        let found = entries.iter().position(|entry| entry.key() == key);

        if action == NIM_DELETE {
            if let Some(index) = found {
                entries.remove(index);
            }

            return;
        }

        if !matches!(action, NIM_ADD | NIM_MODIFY | NIM_SETVERSION) {
            return;
        }

        let index = match found {
            Some(index) => index,
            None => {
                entries.push(Entry {
                    hwnd: incoming.hwnd,
                    id: incoming.id,
                    guid: incoming.guid,
                    callback: 0,
                    version: 0,
                    tooltip: String::new(),
                    icon: 0,
                    png: None,
                    hidden: false,
                });

                entries.len() - 1
            }
        };

        let entry = &mut entries[index];

        if action == NIM_SETVERSION {
            entry.version = incoming.version;

            return;
        }

        if incoming.flags & NIF_MESSAGE != 0 {
            entry.callback = incoming.callback;
        }

        if incoming.flags & NIF_TIP != 0 {
            entry.tooltip = incoming.tooltip;
        }

        if incoming.flags & NIF_STATE != 0 {
            let masked = incoming.state & incoming.state_mask & NIS_HIDDEN;

            if incoming.state_mask & NIS_HIDDEN != 0 {
                entry.hidden = masked != 0;
            }
        }

        if incoming.flags & NIF_GUID != 0 {
            entry.guid = incoming.guid;
        }

        if incoming.flags & NIF_ICON != 0 {
            entry.icon = incoming.icon;
            entry.png = crate::icons::icon_url(incoming.icon);
        }
    }

    fn snapshot() -> Vec<TrayIcon> {
        let mut entries = ENTRIES.lock().unwrap();

        entries.retain(Entry::alive);

        entries
            .iter()
            .filter(|entry| !entry.hidden)
            .map(|entry| TrayIcon {
                id: entry.key(),
                tooltip: entry.tooltip.clone(),
                icon: entry.png.clone(),
                hidden: entry.hidden,
            })
            .collect()
    }

    fn publish() {
        let next = snapshot();
        let mut published = PUBLISHED.lock().unwrap();

        if *published == next {
            return;
        }

        *published = next;

        if let Some(app) = APP.get() {
            let _ = app.emit("tray-icons", ());
        }
    }

    pub fn icons() -> Vec<TrayIcon> {
        let next = snapshot();

        *PUBLISHED.lock().unwrap() = next.clone();

        next
    }

    fn packed(low: u32, high: u32) -> usize {
        (((high & 0xffff) << 16) | (low & 0xffff)) as usize
    }

    fn forward(hwnd: isize, callback: u32, id: u32, version: u32, message: u32) {
        let (wparam, lparam) = if version >= 4 {
            let mut cursor = POINT::default();
            let _ = unsafe { GetCursorPos(&mut cursor) };

            (
                WPARAM(packed(cursor.x as u32, cursor.y as u32)),
                LPARAM(packed(message, id) as isize),
            )
        } else {
            (WPARAM(id as usize), LPARAM(message as isize))
        };

        unsafe {
            let _ = PostMessageW(Some(HWND(hwnd as _)), callback, wparam, lparam);
        }
    }

    pub fn click(id: &str, button: &str) {
        let entries = ENTRIES.lock().unwrap();

        let Some(entry) = entries.iter().find(|entry| entry.key() == id) else {
            return;
        };

        let (hwnd, callback, version, icon) =
            (entry.hwnd, entry.callback, entry.version, entry.id);

        drop(entries);

        if callback == 0 {
            return;
        }

        let right = button == "right";

        let (down, up) = if right {
            (WM_RBUTTONDOWN, WM_RBUTTONUP)
        } else {
            (WM_LBUTTONDOWN, WM_LBUTTONUP)
        };

        unsafe {
            let _ = SetForegroundWindow(HWND(hwnd as _));
        }

        forward(hwnd, callback, icon, version, down);
        forward(hwnd, callback, icon, version, up);

        if right && version >= 4 {
            forward(hwnd, callback, icon, version, WM_CONTEXTMENU);
        }
    }

    unsafe fn relay(message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        let Some(shell) = crate::appbar::shell_tray() else {
            return LRESULT(0);
        };

        let mut answer = 0usize;

        unsafe {
            SendMessageTimeoutW(
                HWND(shell as _),
                message,
                wparam,
                lparam,
                SMTO_ABORTIFHUNG,
                RELAY_TIMEOUT,
                Some(&mut answer),
            )
        };

        LRESULT(answer as isize)
    }

    unsafe extern "system" fn wndproc(
        hwnd: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if message == WM_DESTROY {
            unsafe { PostQuitMessage(0) };

            return LRESULT(0);
        }

        if message != WM_COPYDATA {
            return unsafe { DefWindowProcW(hwnd, message, wparam, lparam) };
        }

        let data = unsafe { &*(lparam.0 as *const COPYDATASTRUCT) };

        if data.dwData != COPYDATA_TRAY {
            return unsafe { relay(message, wparam, lparam) };
        }

        if let Some((action, incoming)) = read(data) {
            apply(action, incoming);
            publish();
        }

        LRESULT(1)
    }

    unsafe fn announce() {
        let created = unsafe { RegisterWindowMessageW(w!("TaskbarCreated")) };

        let _ = unsafe { SendNotifyMessageW(HWND_BROADCAST, created, WPARAM(0), LPARAM(0)) };
    }

    pub fn release() {
        let Some((hwnd, worker)) = HOST.lock().unwrap().take() else {
            return;
        };

        unsafe {
            let _ = PostMessageW(Some(HWND(hwnd as _)), WM_CLOSE, WPARAM(0), LPARAM(0));
        }

        let _ = worker.join();
    }

    pub fn host(app: Option<AppHandle>) {
        if let Some(app) = app {
            let _ = APP.set(app);
        }

        let (ready, started) = std::sync::mpsc::channel();

        let worker = std::thread::spawn(move || unsafe {
            let class = w!("Shell_TrayWnd");
            let instance = GetModuleHandleW(None).unwrap_or_default();

            let descriptor = WNDCLASSEXW {
                cbSize: std::mem::size_of::<WNDCLASSEXW>() as u32,
                lpfnWndProc: Some(wndproc),
                lpszClassName: class,
                hInstance: instance.into(),
                ..Default::default()
            };

            if RegisterClassExW(&descriptor) == 0 {
                crate::trace("tray host class rejected");
                drop(ready);

                return;
            }

            let host = CreateWindowExW(
                WS_EX_TOOLWINDOW | WS_EX_TOPMOST,
                class,
                w!("Eris"),
                WS_POPUP,
                0,
                0,
                1,
                1,
                None,
                None,
                Some(instance.into()),
                None,
            );

            let Ok(host) = host else {
                crate::trace("tray host window rejected");
                drop(ready);

                return;
            };

            let _ = SetWindowPos(
                host,
                Some(HWND_TOPMOST),
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
            );

            let _ = ready.send(host.0 as isize);

            announce();

            crate::trace("tray host listening");

            let mut message = MSG::default();

            while GetMessageW(&mut message, None, 0, 0).as_bool() {
                DispatchMessageW(&message);
            }

            ENTRIES.lock().unwrap().clear();
            announce();
        });

        if let Ok(hwnd) = started.recv() {
            *HOST.lock().unwrap() = Some((hwnd, worker));
        }
    }

    #[cfg(test)]
    mod tests {
        use super::{IconData, TrayMessage};

        #[test]
        fn the_wire_layout_matches_what_shell32_sends() {
            assert_eq!(std::mem::size_of::<IconData>(), 956);
            assert_eq!(std::mem::size_of::<TrayMessage>(), 964);
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use tauri::AppHandle;

    use super::TrayIcon;

    pub fn icons() -> Vec<TrayIcon> {
        Vec::new()
    }

    pub fn click(_id: &str, _button: &str) {}

    pub fn host(_app: Option<AppHandle>) {}

    pub fn release() {}
}
