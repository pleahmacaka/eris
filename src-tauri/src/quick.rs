use serde::Serialize;

#[derive(Serialize)]
pub struct RadioInfo {
    pub kind: String,
    pub state: String,
}

#[derive(Serialize)]
pub struct InputLanguage {
    pub label: String,
    pub layouts: usize,
}

#[tauri::command(async)]
pub fn radios() -> Result<Vec<RadioInfo>, String> {
    win::radios()
}

#[tauri::command(async)]
pub fn set_radio(kind: String, on: bool) -> Result<(), String> {
    win::set_radio(&kind, on)
}

#[tauri::command(async)]
pub fn bluetooth_devices() -> Result<Vec<String>, String> {
    win::bluetooth_devices()
}

#[tauri::command(async)]
pub fn quick_action(action: String) -> Result<(), String> {
    match action.as_str() {
        "notifications" => win::open_or_chord("ms-actioncenter:", win::Chord::Notifications),
        "quicksettings" => win::open_or_chord(
            "ms-actioncenter:controlcenter/&suppressAnimations=false&showFooter=true&allowPageNavigation=true",
            win::Chord::QuickSettings,
        ),
        "taskview" => win::task_view(),
        "desktop" => win::toggle_desktop(),
        other => Err(format!("unknown quick action {other}")),
    }
}

#[tauri::command]
pub fn input_language() -> Option<InputLanguage> {
    win::input_language()
}

#[tauri::command]
pub fn cycle_input_language() -> Result<(), String> {
    win::cycle_input_language()
}

fn language_label(locale: &str, iso3: &str) -> String {
    match locale.split('-').next().unwrap_or_default() {
        "ko" => "한".into(),
        "ja" => "日".into(),
        "zh" => "中".into(),
        _ => iso3.to_uppercase(),
    }
}

#[cfg(target_os = "windows")]
mod win {
    use std::sync::atomic::{AtomicIsize, Ordering};

    use windows::core::{HSTRING, PCWSTR};
    use windows::Devices::Bluetooth::{BluetoothConnectionStatus, BluetoothDevice, BluetoothLEDevice};
    use windows::Devices::Enumeration::DeviceInformation;
    use windows::Devices::Radios::{Radio, RadioAccessStatus, RadioKind, RadioState};
    use windows::Win32::Foundation::{HWND, LPARAM, WPARAM};
    use windows::Win32::Globalization::{GetLocaleInfoEx, LCIDToLocaleName, LOCALE_SISO639LANGNAME2};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        GetKeyboardLayout, GetKeyboardLayoutList, HKL, VK_A, VK_D, VK_LWIN, VK_N, VK_TAB,
    };
    use windows::Win32::UI::Shell::{IShellDispatch4, Shell};
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowThreadProcessId, PostMessageW, WM_INPUTLANGCHANGEREQUEST,
    };

    use super::{InputLanguage, RadioInfo};

    static TARGET: AtomicIsize = AtomicIsize::new(0);

    pub enum Chord {
        Notifications,
        QuickSettings,
    }

    fn text<E: std::fmt::Display>(error: E) -> String {
        error.to_string()
    }

    fn kind_name(kind: RadioKind) -> &'static str {
        match kind {
            RadioKind::WiFi => "wifi",
            RadioKind::Bluetooth => "bluetooth",
            _ => "other",
        }
    }

    fn state_name(state: RadioState) -> &'static str {
        match state {
            RadioState::On => "on",
            RadioState::Off => "off",
            RadioState::Disabled => "disabled",
            _ => "unknown",
        }
    }

    fn access_name(status: RadioAccessStatus) -> &'static str {
        match status {
            RadioAccessStatus::DeniedByUser => "denied-user",
            RadioAccessStatus::DeniedBySystem => "denied-system",
            _ => "unspecified",
        }
    }

    fn all_radios() -> Result<Vec<Radio>, String> {
        let list = Radio::GetRadiosAsync().map_err(text)?.get().map_err(text)?;

        Ok(list.into_iter().collect())
    }

    pub fn radios() -> Result<Vec<RadioInfo>, String> {
        Ok(all_radios()?
            .iter()
            .map(|radio| RadioInfo {
                kind: kind_name(radio.Kind().unwrap_or_default()).into(),
                state: state_name(radio.State().unwrap_or_default()).into(),
            })
            .collect())
    }

    pub fn set_radio(kind: &str, on: bool) -> Result<(), String> {
        let access = Radio::RequestAccessAsync()
            .map_err(text)?
            .get()
            .map_err(text)?;

        if access != RadioAccessStatus::Allowed {
            return Err(access_name(access).into());
        }

        let radio = all_radios()?
            .into_iter()
            .find(|radio| kind_name(radio.Kind().unwrap_or_default()) == kind)
            .ok_or("missing")?;

        let state = if on { RadioState::On } else { RadioState::Off };
        let status = radio.SetStateAsync(state).map_err(text)?.get().map_err(text)?;

        if status != RadioAccessStatus::Allowed {
            return Err(access_name(status).into());
        }

        Ok(())
    }

    pub fn bluetooth_devices() -> Result<Vec<String>, String> {
        let connected = BluetoothConnectionStatus::Connected;
        let selectors = [
            BluetoothDevice::GetDeviceSelectorFromConnectionStatus(connected).map_err(text)?,
            BluetoothLEDevice::GetDeviceSelectorFromConnectionStatus(connected).map_err(text)?,
        ];
        let mut names = Vec::new();

        for selector in selectors {
            let found = DeviceInformation::FindAllAsyncAqsFilter(&selector)
                .map_err(text)?
                .get()
                .map_err(text)?;

            names.extend(
                found
                    .into_iter()
                    .filter_map(|device| device.Name().ok())
                    .map(|name| name.to_string())
                    .filter(|name| !name.is_empty()),
            );
        }

        names.sort();
        names.dedup();

        Ok(names)
    }

    pub fn open_or_chord(uri: &str, chord: Chord) -> Result<(), String> {
        if crate::apps::shell_execute("open", uri, None, true).is_ok() {
            return Ok(());
        }

        let key = match chord {
            Chord::Notifications => VK_N,
            Chord::QuickSettings => VK_A,
        };

        crate::winkey::chord(&[VK_LWIN, key]);

        Ok(())
    }

    pub fn task_view() -> Result<(), String> {
        crate::winkey::chord(&[VK_LWIN, VK_TAB]);

        Ok(())
    }

    pub fn toggle_desktop() -> Result<(), String> {
        let toggled = unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            CoCreateInstance::<_, IShellDispatch4>(&Shell, None, CLSCTX_INPROC_SERVER)
                .and_then(|shell| shell.ToggleDesktop())
        };

        if toggled.is_ok() {
            return Ok(());
        }

        crate::winkey::chord(&[VK_LWIN, VK_D]);

        Ok(())
    }

    // clicking the dock makes it the foreground window, so keep the last real one for layout queries
    fn target() -> HWND {
        let foreground = unsafe { GetForegroundWindow() };
        let mut pid = 0u32;

        unsafe { GetWindowThreadProcessId(foreground, Some(&mut pid)) };

        if !foreground.is_invalid() && pid != std::process::id() {
            TARGET.store(foreground.0 as isize, Ordering::Relaxed);
        }

        HWND(TARGET.load(Ordering::Relaxed) as _)
    }

    fn layouts() -> Vec<HKL> {
        let count = unsafe { GetKeyboardLayoutList(None) }.max(0) as usize;
        let mut list = vec![HKL::default(); count];

        unsafe { GetKeyboardLayoutList(Some(&mut list)) };

        list
    }

    fn layout_of(hwnd: HWND) -> HKL {
        let thread = unsafe { GetWindowThreadProcessId(hwnd, None) };

        unsafe { GetKeyboardLayout(thread) }
    }

    fn langid(layout: HKL) -> u32 {
        (layout.0 as usize & 0xffff) as u32
    }

    fn wide_text(buffer: &[u16], written: i32) -> Option<String> {
        let length = usize::try_from(written).ok()?.checked_sub(1)?;

        Some(String::from_utf16_lossy(&buffer[..length]))
    }

    fn locale_name(layout: HKL) -> Option<String> {
        let mut buffer = [0u16; 85];
        let written = unsafe { LCIDToLocaleName(langid(layout), Some(&mut buffer), 0) };

        wide_text(&buffer, written)
    }

    fn iso3(locale: &str) -> Option<String> {
        let name = HSTRING::from(locale);
        let mut buffer = [0u16; 16];

        let written = unsafe {
            GetLocaleInfoEx(
                PCWSTR(name.as_ptr()),
                LOCALE_SISO639LANGNAME2,
                Some(&mut buffer),
            )
        };

        wide_text(&buffer, written)
    }

    pub fn input_language() -> Option<InputLanguage> {
        let hwnd = target();

        if hwnd.is_invalid() {
            return None;
        }

        let locale = locale_name(layout_of(hwnd))?;
        let iso3 = iso3(&locale).unwrap_or_else(|| locale.clone());

        Some(InputLanguage {
            label: super::language_label(&locale, &iso3),
            layouts: layouts().len(),
        })
    }

    pub fn cycle_input_language() -> Result<(), String> {
        let hwnd = target();

        if hwnd.is_invalid() {
            return Err("no foreground window".into());
        }

        let list = layouts();

        if list.len() < 2 {
            return Ok(());
        }

        let current = layout_of(hwnd);
        let at = list
            .iter()
            .position(|layout| *layout == current)
            .or_else(|| list.iter().position(|layout| langid(*layout) == langid(current)))
            .unwrap_or(0);
        let next = list[(at + 1) % list.len()];

        unsafe {
            PostMessageW(
                Some(hwnd),
                WM_INPUTLANGCHANGEREQUEST,
                WPARAM(0),
                LPARAM(next.0 as isize),
            )
        }
        .map_err(text)
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::{InputLanguage, RadioInfo};

    pub enum Chord {
        Notifications,
        QuickSettings,
    }

    pub fn radios() -> Result<Vec<RadioInfo>, String> {
        Ok(Vec::new())
    }

    pub fn set_radio(_kind: &str, _on: bool) -> Result<(), String> {
        Err("unsupported platform".into())
    }

    pub fn bluetooth_devices() -> Result<Vec<String>, String> {
        Ok(Vec::new())
    }

    pub fn open_or_chord(_uri: &str, _chord: Chord) -> Result<(), String> {
        Err("unsupported platform".into())
    }

    pub fn task_view() -> Result<(), String> {
        Err("unsupported platform".into())
    }

    pub fn toggle_desktop() -> Result<(), String> {
        Err("unsupported platform".into())
    }

    pub fn input_language() -> Option<InputLanguage> {
        None
    }

    pub fn cycle_input_language() -> Result<(), String> {
        Err("unsupported platform".into())
    }
}

#[cfg(test)]
mod tests {
    use super::language_label;

    #[test]
    fn cjk_layouts_use_their_own_glyph_and_others_the_iso_code() {
        assert_eq!(language_label("ko-KR", "kor"), "한");
        assert_eq!(language_label("ja-JP", "jpn"), "日");
        assert_eq!(language_label("zh-TW", "zho"), "中");
        assert_eq!(language_label("en-US", "eng"), "ENG");
        assert_eq!(language_label("de-DE", "deu"), "DEU");
    }
}
