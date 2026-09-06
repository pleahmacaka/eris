use serde::Serialize;
use tauri::AppHandle;

#[derive(Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayIcon {
    pub id: String,
    pub tooltip: String,
    pub icon: Option<String>,
    pub hidden: bool,
    pub promoted: bool,
}

#[tauri::command]
pub fn notify_icons() -> Vec<TrayIcon> {
    win::icons()
}

#[tauri::command]
pub fn notify_icon_click(id: String, button: String) {
    win::click(&id, &button);
}

#[tauri::command]
pub fn notify_icon_promote(id: String, promoted: bool) -> Result<(), String> {
    win::promote(&id, promoted)
}

pub fn host(app: AppHandle) {
    win::host(Some(app));
}

pub fn release() {
    win::release();
}

#[cfg(target_os = "windows")]
mod win {
    use std::collections::{HashMap, HashSet};
    use std::sync::{Mutex, OnceLock};
    use std::thread::JoinHandle;

    use tauri::{AppHandle, Emitter};
    use tauri_plugin_store::StoreExt;
    use windows::core::{w, GUID, PCWSTR, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, LRESULT, POINT, WPARAM};
    use windows::Win32::System::Com::CoTaskMemFree;
    use windows::Win32::System::DataExchange::COPYDATASTRUCT;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegGetValueW, RegOpenKeyExW, RegSetValueExW, HKEY,
        HKEY_CURRENT_USER, KEY_READ, KEY_SET_VALUE, REG_DWORD, RRF_RT_REG_DWORD, RRF_RT_REG_SZ,
    };
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Shell::{SHGetKnownFolderPath, KF_FLAG_DEFAULT};
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetCursorPos, GetMessageW,
        GetWindowThreadProcessId, IsWindow, PostMessageW, PostQuitMessage, RegisterClassExW,
        RegisterWindowMessageW, SendMessageTimeoutW, SendNotifyMessageW, SetForegroundWindow,
        SetWindowPos, HWND_BROADCAST, HWND_TOPMOST, MSG, SMTO_ABORTIFHUNG, SWP_NOACTIVATE,
        SWP_NOMOVE, SWP_NOSIZE, WM_CLOSE, WM_CONTEXTMENU, WM_COPYDATA, WM_DESTROY, WM_LBUTTONDOWN,
        WM_LBUTTONUP, WM_RBUTTONDOWN, WM_RBUTTONUP, WNDCLASSEXW, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
        WS_POPUP,
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
    static CACHED: Mutex<Option<(std::time::Instant, Promotions)>> = Mutex::new(None);
    const CACHE_LIFE: std::time::Duration = std::time::Duration::from_secs(5);

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
        owner: String,
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
                    owner: owner_path(incoming.hwnd).to_lowercase(),
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

    fn dword_value(key: HKEY, sub: PCWSTR, name: PCWSTR) -> Option<u32> {
        let mut value = 0u32;
        let mut size = std::mem::size_of::<u32>() as u32;

        let status = unsafe {
            RegGetValueW(
                key,
                sub,
                name,
                RRF_RT_REG_DWORD,
                None,
                Some(&mut value as *mut u32 as *mut _),
                Some(&mut size),
            )
        };

        status.is_ok().then_some(value)
    }

    fn string_value(key: HKEY, sub: PCWSTR, name: PCWSTR) -> Option<String> {
        let mut buffer = [0u16; 512];
        let mut size = std::mem::size_of_val(&buffer) as u32;

        let status = unsafe {
            RegGetValueW(
                key,
                sub,
                name,
                RRF_RT_REG_SZ,
                None,
                Some(buffer.as_mut_ptr() as *mut _),
                Some(&mut size),
            )
        };

        status.is_ok().then(|| text(&buffer))
    }

    // the shell writes the executable path with a known folder guid standing in for its root
    fn expand(path: &str) -> String {
        let Some(rest) = path.strip_prefix('{') else {
            return path.to_lowercase();
        };

        let Some((id, tail)) = rest.split_once('}') else {
            return path.to_lowercase();
        };

        let Ok(folder) = GUID::try_from(id) else {
            return path.to_lowercase();
        };

        let Ok(root) = (unsafe { SHGetKnownFolderPath(&folder, KF_FLAG_DEFAULT, None) }) else {
            return path.to_lowercase();
        };

        let resolved = unsafe { root.to_string() }.unwrap_or_default();

        unsafe { CoTaskMemFree(Some(root.0 as *const _)) };

        format!("{resolved}{tail}").to_lowercase()
    }

    #[derive(Clone, Default)]
    struct Promotions {
        by_owner: HashMap<String, (String, bool)>,
        by_guid: HashMap<String, (String, bool)>,
        by_exe: HashMap<String, (String, bool)>,
        ambiguous: HashSet<String>,
    }

    impl Promotions {
        // an app can move between versioned folders and swap uid for guid, so widen the match stepwise
        fn find(&self, entry: &Entry) -> Option<&(String, bool)> {
            if entry.guid.iter().any(|byte| *byte != 0) {
                if let Some(found) = self.by_guid.get(&guid_text(&entry.guid)) {
                    return Some(found);
                }
            }

            if let Some(found) = self.by_owner.get(&owner_key(&entry.owner, entry.id)) {
                return Some(found);
            }

            self.by_exe.get(exe_name(&entry.owner))
        }

        fn lookup(&self, entry: &Entry) -> bool {
            self.find(entry)
                .map(|(_, promoted)| *promoted)
                .unwrap_or(true)
        }
    }

    // two icons under one binary cannot be told apart by name, so drop the whole entry when it repeats
    fn note_exe(found: &mut Promotions, path: &str, name: &str, promoted: bool) {
        let exe = exe_name(path).to_string();

        if found.ambiguous.contains(&exe) {
            return;
        }

        if found.by_exe.contains_key(&exe) {
            found.by_exe.remove(&exe);
            found.ambiguous.insert(exe);

            return;
        }

        found.by_exe.insert(exe, (name.to_string(), promoted));
    }

    fn exe_name(path: &str) -> &str {
        path.rsplit('\\').next().unwrap_or(path)
    }

    fn guid_text(bytes: &[u8; 16]) -> String {
        let word = |at: usize| u16::from_le_bytes([bytes[at], bytes[at + 1]]);
        let first = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
        let tail: String = bytes[8..]
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();

        format!(
            "{{{first:08x}-{:04x}-{:04x}-{}-{}}}",
            word(4),
            word(6),
            &tail[..4],
            &tail[4..]
        )
    }

    // the shell keeps the taskbar visibility a user picked per icon here, keyed by owner or guid
    fn promotions() -> Promotions {
        let mut found = Promotions::default();
        let mut key = HKEY::default();

        let opened = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                w!(r"Control Panel\NotifyIconSettings"),
                None,
                KEY_READ,
                &mut key,
            )
        };

        if opened.is_err() {
            return found;
        }

        let mut index = 0;

        loop {
            let mut name = [0u16; 256];
            let mut length = name.len() as u32;

            let status = unsafe {
                RegEnumKeyExW(
                    key,
                    index,
                    Some(PWSTR(name.as_mut_ptr())),
                    &mut length,
                    None,
                    None,
                    None,
                    None,
                )
            };

            if status.is_err() {
                break;
            }

            index += 1;

            let sub = PCWSTR(name.as_ptr());
            let promoted = dword_value(key, sub, w!("IsPromoted")).unwrap_or(0) != 0;

            let name = text(&name[..length as usize]);

            if let Some(item) = string_value(key, sub, w!("GuidItem")) {
                found
                    .by_guid
                    .insert(item.to_lowercase(), (name.clone(), promoted));
            }

            let Some(path) = string_value(key, sub, w!("ExecutablePath")) else {
                continue;
            };

            let Some(uid) = dword_value(key, sub, w!("UID")) else {
                let expanded = expand(&path);

                note_exe(&mut found, &expanded, &name, promoted);

                continue;
            };

            let expanded = expand(&path);

            note_exe(&mut found, &expanded, &name, promoted);

            found
                .by_owner
                .insert(owner_key(&expanded, uid), (name, promoted));
        }

        unsafe {
            let _ = RegCloseKey(key);
        }

        found
    }

    fn owner_key(path: &str, uid: u32) -> String {
        format!("{}|{uid}", path.to_lowercase())
    }

    fn owner_path(hwnd: isize) -> String {
        let mut pid = 0u32;

        unsafe { GetWindowThreadProcessId(HWND(hwnd as _), Some(&mut pid)) };

        let Ok(process) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) })
        else {
            return String::new();
        };

        let mut buffer = [0u16; 512];
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

        match query {
            Ok(()) => String::from_utf16_lossy(&buffer[..length as usize]),
            Err(_) => String::new(),
        }
    }

    // an icon the shell has never seen has no registry entry, so remember the choice ourselves
    fn local_hidden() -> Vec<String> {
        let Some(app) = APP.get() else {
            return Vec::new();
        };

        app.store("tray.json")
            .ok()
            .and_then(|store| store.get("hidden"))
            .and_then(|value| serde_json::from_value(value).ok())
            .unwrap_or_default()
    }

    fn set_local_hidden(id: &str, hidden: bool) -> Result<(), String> {
        let app = APP.get().ok_or("no app handle")?;
        let store = app.store("tray.json").map_err(|e| e.to_string())?;
        let mut ids = local_hidden();

        ids.retain(|found| found != id);

        if hidden {
            ids.push(id.to_string());
        }

        store.set("hidden", serde_json::json!(ids));
        store.save().map_err(|e| e.to_string())?;

        publish();

        Ok(())
    }

    pub fn promote(id: &str, promoted: bool) -> Result<(), String> {
        let found = {
            let entries = ENTRIES.lock().unwrap();
            let entry = entries
                .iter()
                .find(|entry| entry.key() == id)
                .ok_or("tray icon is gone")?;

            cached_promotions()
                .find(entry)
                .map(|(name, _)| name.clone())
        };

        let Some(subkey) = found else {
            return set_local_hidden(id, !promoted);
        };

        let path: Vec<u16> = format!(r"Control Panel\NotifyIconSettings\{subkey}")
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let mut key = HKEY::default();

        let opened = unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                PCWSTR(path.as_ptr()),
                None,
                KEY_SET_VALUE,
                &mut key,
            )
        };

        opened.ok().map_err(|e| e.to_string())?;

        let value = u32::from(promoted);

        let written = unsafe {
            RegSetValueExW(
                key,
                w!("IsPromoted"),
                None,
                REG_DWORD,
                Some(&value.to_le_bytes()),
            )
        };

        unsafe {
            let _ = RegCloseKey(key);
        }

        written.ok().map_err(|e| e.to_string())?;

        forget_promotions();
        publish();

        Ok(())
    }

    // rebuilding the map walks the whole registry, and this runs inside the tray host's wnd proc
    fn cached_promotions() -> Promotions {
        let mut cache = CACHED.lock().unwrap();

        if let Some((at, found)) = cache.as_ref() {
            if at.elapsed() < CACHE_LIFE {
                return found.clone();
            }
        }

        let found = promotions();

        *cache = Some((std::time::Instant::now(), found.clone()));

        found
    }

    fn forget_promotions() {
        *CACHED.lock().unwrap() = None;
    }

    fn snapshot() -> Vec<TrayIcon> {
        let mut entries = ENTRIES.lock().unwrap();

        entries.retain(Entry::alive);

        let promoted = cached_promotions();
        let hidden = local_hidden();

        entries
            .iter()
            .filter(|entry| !entry.hidden)
            .map(|entry| TrayIcon {
                id: entry.key(),
                tooltip: entry.tooltip.clone(),
                icon: entry.png.clone(),
                hidden: entry.hidden,
                promoted: match hidden.contains(&entry.key()) {
                    true => false,
                    false => promoted.lookup(entry),
                },
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

        let (hwnd, callback, version, icon) = (entry.hwnd, entry.callback, entry.version, entry.id);

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

    // Shell_NotifyIcon delivers to the first window of the class in z order, so stay above the shell's
    fn keep_front(host: isize) {
        std::thread::spawn(move || loop {
            std::thread::sleep(std::time::Duration::from_secs(5));

            if HOST.lock().unwrap().is_none() {
                return;
            }

            unsafe {
                let _ = SetWindowPos(
                    HWND(host as _),
                    Some(HWND_TOPMOST),
                    0,
                    0,
                    0,
                    0,
                    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
                );
            }
        });
    }

    // an app that was already running when the host appeared only re-adds its icon on this broadcast
    fn re_announce() {
        std::thread::spawn(|| {
            for wait in [2, 8, 20, 45, 90] {
                std::thread::sleep(std::time::Duration::from_secs(wait));

                if HOST.lock().unwrap().is_none() {
                    return;
                }

                unsafe { announce() };
            }
        });
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

            re_announce();
            keep_front(hwnd);
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
