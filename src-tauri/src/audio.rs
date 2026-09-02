use serde::Serialize;

#[derive(Serialize)]
pub struct Volume {
    pub level: f32,
    pub muted: bool,
}

pub fn volume() -> Option<Volume> {
    win::volume()
}

#[tauri::command]
pub fn set_volume(level: f32) -> Result<(), String> {
    win::set_level(level.clamp(0.0, 1.0))
}

#[tauri::command]
pub fn toggle_mute() -> Result<(), String> {
    win::toggle_mute()
}

#[cfg(target_os = "windows")]
mod win {
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
    };

    use super::Volume;

    fn endpoint() -> windows::core::Result<IAudioEndpointVolume> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;

            device.Activate(CLSCTX_ALL, None)
        }
    }

    fn text(error: windows::core::Error) -> String {
        error.to_string()
    }

    pub fn volume() -> Option<Volume> {
        let endpoint = endpoint().ok()?;

        unsafe {
            Some(Volume {
                level: endpoint.GetMasterVolumeLevelScalar().ok()?,
                muted: endpoint.GetMute().ok()?.as_bool(),
            })
        }
    }

    pub fn set_level(level: f32) -> Result<(), String> {
        let endpoint = endpoint().map_err(text)?;

        unsafe { endpoint.SetMasterVolumeLevelScalar(level, std::ptr::null()) }.map_err(text)
    }

    pub fn toggle_mute() -> Result<(), String> {
        let endpoint = endpoint().map_err(text)?;

        unsafe {
            let muted = endpoint.GetMute().map_err(text)?.as_bool();

            endpoint.SetMute(!muted, std::ptr::null()).map_err(text)
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::Volume;

    pub fn volume() -> Option<Volume> {
        None
    }

    pub fn set_level(_level: f32) -> Result<(), String> {
        Err("unsupported platform".into())
    }

    pub fn toggle_mute() -> Result<(), String> {
        Err("unsupported platform".into())
    }
}
