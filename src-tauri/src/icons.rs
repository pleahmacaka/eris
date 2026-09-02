use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

use base64::Engine;
use tauri::{AppHandle, Manager};

fn memory() -> &'static Mutex<HashMap<String, String>> {
    static MEMORY: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

    MEMORY.get_or_init(Default::default)
}

fn cached_file(app: &AppHandle, key: &str) -> Option<PathBuf> {
    let dir = app.path().app_cache_dir().ok()?.join("icons");

    Some(dir.join(format!("{key}.png")))
}

pub fn render_png(path: &str) -> Option<Vec<u8>> {
    let (width, height, pixels) = win::pixels(path)?;
    let image = image::RgbaImage::from_raw(width, height, pixels)?;
    let mut png = std::io::Cursor::new(Vec::new());

    image.write_to(&mut png, image::ImageFormat::Png).ok()?;

    Some(png.into_inner())
}

#[tauri::command(async)]
pub fn app_icon(app: AppHandle, path: String) -> Option<String> {
    let key = crate::apps::stable_id(&path);

    if let Some(hit) = memory().lock().unwrap().get(&key) {
        return Some(hit.clone());
    }

    let file = cached_file(&app, &key);

    let png = file
        .as_ref()
        .and_then(|file| std::fs::read(file).ok())
        .or_else(|| {
            let png = render_png(&path)?;

            if let Some(file) = &file {
                let _ = file.parent().map(std::fs::create_dir_all);
                let _ = std::fs::write(file, &png);
            }

            Some(png)
        })?;

    let url = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(png)
    );

    memory().lock().unwrap().insert(key, url.clone());

    Some(url)
}

#[tauri::command]
pub fn clear_icon_cache(app: AppHandle) -> Result<(), String> {
    memory().lock().unwrap().clear();

    let Ok(dir) = app.path().app_cache_dir() else {
        return Ok(());
    };

    let icons = dir.join("icons");

    if !icons.is_dir() {
        return Ok(());
    }

    std::fs::remove_dir_all(icons).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
mod win {
    use windows::core::HSTRING;
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::{
        DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
    };
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{
        IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK, SIIGBF_ICONONLY,
    };

    const ICON_SIZE: i32 = 64;

    unsafe fn image_of(path: &str) -> Option<HBITMAP> {
        let factory: IShellItemImageFactory =
            unsafe { SHCreateItemFromParsingName(&HSTRING::from(path), None) }.ok()?;

        let size = SIZE {
            cx: ICON_SIZE,
            cy: ICON_SIZE,
        };

        unsafe { factory.GetImage(size, SIIGBF_ICONONLY | SIIGBF_BIGGERSIZEOK) }.ok()
    }

    unsafe fn rgba(bitmap: HBITMAP) -> Option<(u32, u32, Vec<u8>)> {
        let mut info = BITMAP::default();

        unsafe {
            GetObjectW(
                HGDIOBJ(bitmap.0),
                std::mem::size_of::<BITMAP>() as i32,
                Some(&mut info as *mut _ as *mut _),
            )
        };

        let (width, height) = (info.bmWidth as u32, info.bmHeight as u32);

        if width == 0 || height == 0 {
            return None;
        }

        let mut buffer = vec![0u8; (width * height * 4) as usize];

        let mut header = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width as i32,
                biHeight: -(height as i32),
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let dc = unsafe { GetDC(None) };

        let copied = unsafe {
            GetDIBits(
                dc,
                bitmap,
                0,
                height,
                Some(buffer.as_mut_ptr() as *mut _),
                &mut header,
                DIB_RGB_COLORS,
            )
        };

        unsafe { ReleaseDC(None, dc) };

        if copied == 0 {
            return None;
        }

        let opaque = buffer.chunks_exact(4).all(|pixel| pixel[3] == 0);

        for pixel in buffer.chunks_exact_mut(4) {
            pixel.swap(0, 2);

            let alpha = pixel[3] as u32;

            if opaque {
                pixel[3] = 255;
            } else if alpha > 0 && alpha < 255 {
                for channel in &mut pixel[..3] {
                    *channel = ((*channel as u32 * 255 + alpha / 2) / alpha).min(255) as u8;
                }
            }
        }

        Some((width, height, buffer))
    }

    pub fn pixels(path: &str) -> Option<(u32, u32, Vec<u8>)> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let target = crate::apps::shortcut_target(path);
            let bitmap = target
                .as_deref()
                .and_then(|target| image_of(target))
                .or_else(|| image_of(path))?;
            let result = rgba(bitmap);

            let _ = DeleteObject(HGDIOBJ(bitmap.0));

            result
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    pub fn pixels(_path: &str) -> Option<(u32, u32, Vec<u8>)> {
        None
    }
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    #[test]
    fn renders_an_icon_from_a_start_menu_shortcut() {
        let apps = crate::apps::list_apps();

        let png = apps
            .iter()
            .filter(|app| app.path.to_lowercase().ends_with(".lnk"))
            .find_map(|app| super::render_png(&app.path));

        assert!(
            png.is_some_and(|bytes| bytes.starts_with(b"\x89PNG")),
            "no icon rendered from any shortcut"
        );
    }
}
