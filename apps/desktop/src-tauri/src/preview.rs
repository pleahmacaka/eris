use serde::Serialize;
use tauri::AppHandle;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewSlot {
    pub hwnd: isize,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub header: f64,
    pub title: String,
}

#[tauri::command]
pub fn preview_show(app: AppHandle, windows: Vec<isize>, center: f64) {
    win::show(&app, &windows, center);
}

#[tauri::command]
pub fn preview_hide(app: AppHandle) {
    win::hide(&app);
}

#[cfg(target_os = "windows")]
mod win {
    use std::sync::Mutex;

    use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize};
    use windows::Win32::Foundation::{HWND, RECT};
    use windows::Win32::Graphics::Dwm::{
        DwmRegisterThumbnail, DwmUnregisterThumbnail, DwmUpdateThumbnailProperties,
        DWM_THUMBNAIL_PROPERTIES, DWM_TNP_OPACITY, DWM_TNP_RECTDESTINATION,
        DWM_TNP_SOURCECLIENTAREAONLY, DWM_TNP_VISIBLE,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetWindowTextW, ShowWindow, SW_HIDE, SW_SHOWNA};

    use super::PreviewSlot;

    const THUMB_WIDTH: f64 = 208.0;
    const THUMB_HEIGHT: f64 = 124.0;
    const PADDING: f64 = 8.0;
    const TILE_PADDING: f64 = 6.0;
    const HEADER: f64 = 30.0;
    const TILE_WIDTH: f64 = THUMB_WIDTH + TILE_PADDING * 2.0;
    const TILE_HEIGHT: f64 = HEADER + THUMB_HEIGHT + TILE_PADDING;
    const GAP: f64 = 4.0;
    const DOCK_GAP: f64 = 8.0;
    const MAX_THUMBS: usize = 4;

    static THUMBS: Mutex<Vec<isize>> = Mutex::new(Vec::new());

    fn clear() {
        for thumb in std::mem::take(&mut *THUMBS.lock().unwrap()) {
            unsafe {
                let _ = DwmUnregisterThumbnail(thumb);
            }
        }
    }

    fn slots(count: usize) -> Vec<(f64, f64)> {
        (0..count)
            .map(|index| {
                let left = PADDING + index as f64 * (TILE_WIDTH + GAP);

                (left, PADDING)
            })
            .collect()
    }

    fn layout(count: usize) -> (f64, f64) {
        let width = PADDING * 2.0 + count as f64 * TILE_WIDTH + (count - 1) as f64 * GAP;

        (width, PADDING * 2.0 + TILE_HEIGHT)
    }

    fn title(hwnd: HWND) -> String {
        let mut buffer = [0u16; 256];
        let length = unsafe { GetWindowTextW(hwnd, &mut buffer) }.max(0) as usize;

        String::from_utf16_lossy(&buffer[..length])
    }

    pub fn show(app: &AppHandle, windows: &[isize], center: f64) {
        clear();

        let sources: Vec<isize> = windows.iter().copied().take(MAX_THUMBS).collect();

        if sources.is_empty() {
            return hide(app);
        }

        let (Some(preview), Some(dock)) = (
            app.get_webview_window("preview"),
            app.get_webview_window("taskbar"),
        ) else {
            return hide(app);
        };

        let Ok(scale) = dock.scale_factor() else {
            return hide(app);
        };

        let Ok(Some(monitor)) = dock.current_monitor() else {
            return hide(app);
        };

        // a menu extends the dock window upward, so anchor to the band it reserves instead
        let [dock_left, dock_top, _, dock_height] = match crate::appbar::dock_frame() {
            Some(frame) => frame,
            None => {
                let (Ok(position), Ok(size)) = (dock.outer_position(), dock.outer_size()) else {
                    return hide(app);
                };

                [
                    position.x,
                    position.y,
                    size.width as i32,
                    size.height as i32,
                ]
            }
        };

        let (width, height) = layout(sources.len());
        let physical_width = (width * scale).round() as i32;
        let physical_height = (height * scale).round() as i32;
        let work = monitor.work_area();
        let anchor = dock_left + (center * scale).round() as i32;
        let left = (anchor - physical_width / 2)
            .max(work.position.x)
            .min(work.position.x + work.size.width as i32 - physical_width);

        let gap = (DOCK_GAP * scale).round() as i32;

        let top = if crate::appbar::edge_is_top() {
            dock_top + dock_height + gap
        } else {
            dock_top - gap - physical_height
        };

        if preview
            .set_size(PhysicalSize::new(
                physical_width as u32,
                physical_height as u32,
            ))
            .is_err()
            || preview
                .set_position(PhysicalPosition::new(left, top))
                .is_err()
        {
            return hide(app);
        }

        let Ok(handle) = preview.hwnd() else {
            return hide(app);
        };

        let destination = HWND(handle.0 as _);
        let mut registered = Vec::new();
        let mut placed = Vec::new();

        // DWM draws thumbnails above the page, so nothing interactive may sit inside their rect
        for (source, (x, y)) in sources.iter().zip(slots(sources.len())) {
            let (thumb_left, thumb_top) = (x + TILE_PADDING, y + HEADER);

            let Ok(thumb) = (unsafe { DwmRegisterThumbnail(destination, HWND(*source as _)) })
            else {
                continue;
            };

            let properties = DWM_THUMBNAIL_PROPERTIES {
                dwFlags: DWM_TNP_RECTDESTINATION
                    | DWM_TNP_VISIBLE
                    | DWM_TNP_OPACITY
                    | DWM_TNP_SOURCECLIENTAREAONLY,
                rcDestination: RECT {
                    left: (thumb_left * scale).round() as i32,
                    top: (thumb_top * scale).round() as i32,
                    right: ((thumb_left + THUMB_WIDTH) * scale).round() as i32,
                    bottom: ((thumb_top + THUMB_HEIGHT) * scale).round() as i32,
                },
                opacity: 255,
                fVisible: true.into(),
                fSourceClientAreaOnly: false.into(),
                ..Default::default()
            };

            if unsafe { DwmUpdateThumbnailProperties(thumb, &properties) }.is_err() {
                unsafe {
                    let _ = DwmUnregisterThumbnail(thumb);
                }

                continue;
            }

            registered.push(thumb);
            placed.push(PreviewSlot {
                hwnd: *source,
                x,
                y,
                width: TILE_WIDTH,
                height: TILE_HEIGHT,
                header: HEADER,
                title: title(HWND(*source as _)),
            });
        }

        if registered.is_empty() {
            return hide(app);
        }

        *THUMBS.lock().unwrap() = registered;

        let _ = app.emit("preview-shown", placed);

        crate::windowing::webview_visible(app, "preview", true);

        unsafe {
            let _ = ShowWindow(destination, SW_SHOWNA);
        }
    }

    pub fn hide(app: &AppHandle) {
        clear();

        let Some(preview) = app.get_webview_window("preview") else {
            return;
        };

        let _ = app.emit("preview-hidden", ());

        if let Ok(handle) = preview.hwnd() {
            unsafe {
                let _ = ShowWindow(HWND(handle.0 as _), SW_HIDE);
            }
        }

        crate::windowing::webview_visible(app, "preview", false);
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use tauri::AppHandle;

    pub fn show(_app: &AppHandle, _windows: &[isize], _center: f64) {}

    pub fn hide(_app: &AppHandle) {}
}
