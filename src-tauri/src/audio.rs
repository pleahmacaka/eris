use serde::Serialize;

#[derive(Serialize)]
pub struct Volume {
    pub level: f32,
    pub muted: bool,
}

#[derive(Serialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub default: bool,
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

#[tauri::command(async)]
pub fn audio_devices() -> Vec<AudioDevice> {
    win::devices()
}

#[tauri::command(async)]
pub fn set_audio_device(id: String) -> Result<(), String> {
    win::set_default(&id)
}

#[cfg(target_os = "windows")]
mod win {
    use windows::core::{interface, BOOL, GUID, HRESULT, IUnknown, IUnknown_Vtbl, PCWSTR};
    use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
    use windows::Win32::Media::Audio::Endpoints::IAudioEndpointVolume;
    use windows::Win32::Media::Audio::{
        eCommunications, eConsole, eMultimedia, eRender, IMMDevice, IMMDeviceEnumerator,
        MMDeviceEnumerator, DEVICE_STATE_ACTIVE,
    };
    use windows::Win32::System::Com::StructuredStorage::PropVariantToStringAlloc;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
        STGM_READ,
    };

    use super::{AudioDevice, Volume};

    const POLICY_CONFIG_CLIENT: GUID =
        GUID::from_u128(0x870af99c_171d_4f9e_af0d_e63df40c2bc9);

    // undocumented interface: the vtable order below is fixed, never reorder or trim
    #[interface("f8679f50-850a-41cf-9c72-430f290290c8")]
    unsafe trait IPolicyConfig: IUnknown {
        unsafe fn get_mix_format(&self, name: PCWSTR, format: *mut *mut c_void) -> HRESULT;
        unsafe fn get_device_format(
            &self,
            name: PCWSTR,
            default: BOOL,
            format: *mut *mut c_void,
        ) -> HRESULT;
        unsafe fn reset_device_format(&self, name: PCWSTR) -> HRESULT;
        unsafe fn set_device_format(
            &self,
            name: PCWSTR,
            endpoint: *mut c_void,
            mix: *mut c_void,
        ) -> HRESULT;
        unsafe fn get_processing_period(
            &self,
            name: PCWSTR,
            default: BOOL,
            period: *mut i64,
            minimum: *mut i64,
        ) -> HRESULT;
        unsafe fn set_processing_period(&self, name: PCWSTR, period: *mut i64) -> HRESULT;
        unsafe fn get_share_mode(&self, name: PCWSTR, mode: *mut c_void) -> HRESULT;
        unsafe fn set_share_mode(&self, name: PCWSTR, mode: *mut c_void) -> HRESULT;
        unsafe fn get_property_value(
            &self,
            name: PCWSTR,
            key: *const c_void,
            value: *mut c_void,
        ) -> HRESULT;
        unsafe fn set_property_value(
            &self,
            name: PCWSTR,
            key: *const c_void,
            value: *mut c_void,
        ) -> HRESULT;
        unsafe fn set_default_endpoint(&self, name: PCWSTR, role: i32) -> HRESULT;
        unsafe fn set_endpoint_visibility(&self, name: PCWSTR, visible: BOOL) -> HRESULT;
    }

    use std::ffi::c_void;

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

    fn friendly_name(device: &IMMDevice) -> Option<String> {
        unsafe {
            let store = device.OpenPropertyStore(STGM_READ).ok()?;
            let value = store.GetValue(&PKEY_Device_FriendlyName).ok()?;
            let text = PropVariantToStringAlloc(&value).ok()?;
            let name = text.to_string().ok()?;

            CoTaskMemFree(Some(text.0 as *mut _));

            Some(name)
        }
    }

    fn device_id(device: &IMMDevice) -> Option<String> {
        unsafe {
            let raw = device.GetId().ok()?;
            let id = raw.to_string().ok()?;

            CoTaskMemFree(Some(raw.0 as *mut _));

            Some(id)
        }
    }

    pub fn devices() -> Vec<AudioDevice> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let Ok(enumerator) =
                CoCreateInstance::<_, IMMDeviceEnumerator>(&MMDeviceEnumerator, None, CLSCTX_ALL)
            else {
                return Vec::new();
            };

            let current = enumerator
                .GetDefaultAudioEndpoint(eRender, eConsole)
                .ok()
                .as_ref()
                .and_then(device_id);

            let Ok(collection) = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE) else {
                return Vec::new();
            };

            let count = collection.GetCount().unwrap_or(0);

            (0..count)
                .filter_map(|index| {
                    let device = collection.Item(index).ok()?;
                    let id = device_id(&device)?;
                    let name = friendly_name(&device)?;
                    let default = current.as_deref() == Some(id.as_str());

                    Some(AudioDevice { id, name, default })
                })
                .collect()
        }
    }

    pub fn set_default(id: &str) -> Result<(), String> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let policy: IPolicyConfig =
                CoCreateInstance(&POLICY_CONFIG_CLIENT, None, CLSCTX_ALL).map_err(text)?;
            let wide: Vec<u16> = id.encode_utf16().chain(std::iter::once(0)).collect();

            for role in [eConsole, eMultimedia, eCommunications] {
                policy
                    .set_default_endpoint(PCWSTR(wide.as_ptr()), role.0)
                    .ok()
                    .map_err(text)?;
            }
        }

        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::{AudioDevice, Volume};

    pub fn volume() -> Option<Volume> {
        None
    }

    pub fn devices() -> Vec<AudioDevice> {
        Vec::new()
    }

    pub fn set_default(_id: &str) -> Result<(), String> {
        Err("unsupported platform".into())
    }

    pub fn set_level(_level: f32) -> Result<(), String> {
        Err("unsupported platform".into())
    }

    pub fn toggle_mute() -> Result<(), String> {
        Err("unsupported platform".into())
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    #[test]
    fn the_default_endpoint_can_be_reassigned_to_itself() {
        let devices = super::win::devices();

        assert!(!devices.is_empty(), "no active render endpoints");

        let current = devices
            .iter()
            .find(|device| device.default)
            .expect("no default render endpoint");

        super::win::set_default(&current.id).expect("IPolicyConfig rejected the current default");
    }
}
