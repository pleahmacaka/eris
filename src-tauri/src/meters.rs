use serde::Serialize;

const MB: u64 = 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Meters {
    pub cpu: f32,
    pub memory: f32,
    pub memory_used_mb: u64,
    pub memory_total_mb: u64,
    pub network: Option<NetworkInfo>,
}

#[derive(Serialize)]
pub struct NetworkInfo {
    pub kind: String,
    pub name: String,
    pub connected: bool,
}

#[tauri::command(async)]
pub fn system_meters() -> Meters {
    let (used, total) = win::memory().unwrap_or_default();

    Meters {
        cpu: win::cpu(),
        memory: ratio(used, total),
        memory_used_mb: used / MB,
        memory_total_mb: total / MB,
        network: win::network(),
    }
}

fn ratio(part: u64, whole: u64) -> f32 {
    if whole == 0 {
        return 0.0;
    }

    (part as f32 / whole as f32).clamp(0.0, 1.0)
}

fn kind(connected: bool, wireless: bool) -> &'static str {
    match (connected, wireless) {
        (false, _) => "none",
        (true, true) => "wifi",
        (true, false) => "ethernet",
    }
}

#[cfg(target_os = "windows")]
mod win {
    use std::sync::Mutex;
    use std::thread::sleep;
    use std::time::Duration;

    use windows::Networking::Connectivity::{NetworkConnectivityLevel, NetworkInformation};
    use windows::Win32::Foundation::FILETIME;
    use windows::Win32::System::Threading::GetSystemTimes;

    use super::NetworkInfo;

    const SEED_WINDOW: Duration = Duration::from_millis(120);

    static PREVIOUS: Mutex<Option<(u64, u64)>> = Mutex::new(None);

    #[repr(C)]
    #[derive(Default)]
    struct MemoryStatus {
        length: u32,
        _load: u32,
        total_phys: u64,
        avail_phys: u64,
        _rest: [u64; 5],
    }

    // GlobalMemoryStatusEx sits behind a windows-crate feature this build does not enable
    #[link(name = "kernel32")]
    extern "system" {
        fn GlobalMemoryStatusEx(buffer: *mut MemoryStatus) -> i32;
    }

    pub fn memory() -> Option<(u64, u64)> {
        let mut status = MemoryStatus {
            length: std::mem::size_of::<MemoryStatus>() as u32,
            ..Default::default()
        };

        if unsafe { GlobalMemoryStatusEx(&mut status) } == 0 {
            return None;
        }

        Some((
            status.total_phys.saturating_sub(status.avail_phys),
            status.total_phys,
        ))
    }

    pub fn cpu() -> f32 {
        let mut previous = PREVIOUS.lock().unwrap();

        let Some(first) = sample() else {
            return 0.0;
        };

        let Some(base) = previous.replace(first) else {
            // ponytail: one 120 ms wait under the lock, only for the first sample of the process
            sleep(SEED_WINDOW);

            let Some(second) = sample() else {
                return 0.0;
            };

            *previous = Some(second);

            return busy_ratio(first, second);
        };

        busy_ratio(base, first)
    }

    fn sample() -> Option<(u64, u64)> {
        let mut idle = FILETIME::default();
        let mut kernel = FILETIME::default();
        let mut user = FILETIME::default();

        unsafe { GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)) }.ok()?;

        let total = ticks(kernel).saturating_add(ticks(user));

        Some((total.saturating_sub(ticks(idle)), total))
    }

    fn busy_ratio(base: (u64, u64), now: (u64, u64)) -> f32 {
        super::ratio(now.0.saturating_sub(base.0), now.1.saturating_sub(base.1))
    }

    pub fn network() -> Option<NetworkInfo> {
        let active = internet_profile();
        let connected = active.is_some();
        let (wireless, name) = active.unwrap_or_default();

        Some(NetworkInfo {
            kind: super::kind(connected, wireless).into(),
            name,
            connected,
        })
    }

    fn internet_profile() -> Option<(bool, String)> {
        let profile = NetworkInformation::GetInternetConnectionProfile().ok()?;

        if profile.GetNetworkConnectivityLevel().ok()? == NetworkConnectivityLevel::None {
            return None;
        }

        let wireless = profile.IsWlanConnectionProfile().unwrap_or(false)
            || profile.IsWwanConnectionProfile().unwrap_or(false);

        let name = profile
            .ProfileName()
            .map(|name| name.to_string())
            .unwrap_or_default();

        Some((wireless, name))
    }

    fn ticks(time: FILETIME) -> u64 {
        (time.dwHighDateTime as u64) << 32 | time.dwLowDateTime as u64
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::NetworkInfo;

    pub fn memory() -> Option<(u64, u64)> {
        None
    }

    pub fn cpu() -> f32 {
        0.0
    }

    pub fn network() -> Option<NetworkInfo> {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::{kind, ratio};

    #[test]
    fn ratio_handles_empty_and_full() {
        assert_eq!(ratio(0, 0), 0.0);
        assert_eq!(ratio(1, 4), 0.25);
        assert_eq!(ratio(9, 4), 1.0);
    }

    #[test]
    fn kind_reports_none_only_when_disconnected() {
        assert_eq!(kind(true, true), "wifi");
        assert_eq!(kind(true, false), "ethernet");
        assert_eq!(kind(false, true), "none");
        assert_eq!(kind(false, false), "none");
    }
}
