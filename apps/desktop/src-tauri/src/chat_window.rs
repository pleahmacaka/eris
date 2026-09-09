use std::sync::Mutex;

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

#[derive(Clone, Copy, serde::Serialize)]
pub struct ChatRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Clone, serde::Serialize)]
pub struct ChatArea {
    pub width: f64,
    pub height: f64,
    pub monitors: Vec<ChatRect>,
    pub home: usize,
}

struct ChatSpace {
    origin: PhysicalPosition<i32>,
    scale: f64,
    area: ChatArea,
}

static CHAT_SPACE: Mutex<Option<ChatSpace>> = Mutex::new(None);
static CHAT_FRAME: Mutex<Option<[i32; 4]>> = Mutex::new(None);
static CHAT_RECTS: Mutex<Vec<[i32; 5]>> = Mutex::new(Vec::new());

// moving the window origin races the page's own offset, so the window always spans the plane and only its region changes
pub(crate) fn park_chat(window: &WebviewWindow) -> tauri::Result<()> {
    let cursor = window.cursor_position()?;
    let monitors = window.available_monitors()?;

    if monitors.is_empty() {
        return Ok(());
    }

    let scale = window
        .primary_monitor()?
        .map(|monitor| monitor.scale_factor())
        .unwrap_or(1.0);
    let works: Vec<(PhysicalPosition<i32>, PhysicalSize<u32>)> = monitors
        .iter()
        .map(|monitor| {
            let work = monitor.work_area();

            (work.position, work.size)
        })
        .collect();
    let origin = PhysicalPosition::new(
        works.iter().map(|(p, _)| p.x).min().unwrap_or(0),
        works.iter().map(|(p, _)| p.y).min().unwrap_or(0),
    );
    let right = works
        .iter()
        .map(|(p, s)| p.x + s.width as i32)
        .max()
        .unwrap_or(0);
    let bottom = works
        .iter()
        .map(|(p, s)| p.y + s.height as i32)
        .max()
        .unwrap_or(0);
    let home = works
        .iter()
        .position(|(p, s)| {
            cursor.x >= f64::from(p.x)
                && cursor.x < f64::from(p.x + s.width as i32)
                && cursor.y >= f64::from(p.y)
                && cursor.y < f64::from(p.y + s.height as i32)
        })
        .unwrap_or(0);
    let rects = works
        .iter()
        .map(|(p, s)| ChatRect {
            x: f64::from(p.x - origin.x) / scale,
            y: f64::from(p.y - origin.y) / scale,
            width: f64::from(s.width) / scale,
            height: f64::from(s.height) / scale,
        })
        .collect();

    let first = CHAT_SPACE.lock().unwrap().is_none();

    *CHAT_SPACE.lock().unwrap() = Some(ChatSpace {
        origin,
        scale,
        area: ChatArea {
            width: f64::from(right - origin.x) / scale,
            height: f64::from(bottom - origin.y) / scale,
            monitors: rects,
            home,
        },
    });

    place_chat(
        window,
        [origin.x, origin.y, right - origin.x, bottom - origin.y],
    )?;

    if first {
        clip_chat(&window.app_handle().clone(), Vec::new());
    }

    Ok(())
}

fn place_chat(window: &WebviewWindow, frame: [i32; 4]) -> tauri::Result<()> {
    let mut last = CHAT_FRAME.lock().unwrap();

    if *last == Some(frame) {
        return Ok(());
    }

    let [x, y, width, height] = frame;

    window.set_position(PhysicalPosition::new(x, y))?;
    window.set_size(PhysicalSize::new(width.max(1) as u32, height.max(1) as u32))?;
    *last = Some(frame);

    Ok(())
}

fn clip_chat(app: &AppHandle, rects: Vec<[i32; 5]>) {
    let mut last = CHAT_RECTS.lock().unwrap();

    if *last == rects {
        return;
    }

    region::apply(app, "chat", &rects);
    *last = rects;
}

#[tauri::command]
pub fn chat_area() -> Option<ChatArea> {
    CHAT_SPACE
        .lock()
        .unwrap()
        .as_ref()
        .map(|space| space.area.clone())
}

#[tauri::command]
pub fn chat_frame(app: AppHandle, frame: [f64; 4], rects: Vec<[f64; 5]>) {
    let Some(window) = app.get_webview_window("chat") else {
        return;
    };

    let (origin, scale) = match CHAT_SPACE.lock().unwrap().as_ref() {
        Some(space) => (space.origin, space.scale),
        None => return,
    };

    let px = |value: f64| (value * scale).round() as i32;
    let [x, y, width, height] = frame;

    let _ = place_chat(
        &window,
        [origin.x + px(x), origin.y + px(y), px(width), px(height)],
    );

    clip_chat(&app, rects.iter().map(|rect| rect.map(px)).collect());
}

#[cfg(target_os = "windows")]
mod region {
    use tauri::{AppHandle, Manager};
    use windows::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, CreateRoundRectRgn, DeleteObject, SetWindowRgn, RGN_OR,
    };

    pub fn apply(app: &AppHandle, label: &str, rects: &[[i32; 5]]) {
        let Some(window) = app.get_webview_window(label) else {
            return;
        };

        let Ok(hwnd) = window.hwnd() else {
            return;
        };

        unsafe {
            let region = CreateRectRgn(0, 0, 0, 0);

            for [left, top, right, bottom, radius] in rects {
                let part = if *radius > 0 {
                    CreateRoundRectRgn(*left, *top, *right, *bottom, radius * 2, radius * 2)
                } else {
                    CreateRectRgn(*left, *top, *right, *bottom)
                };

                CombineRgn(Some(region), Some(region), Some(part), RGN_OR);

                let _ = DeleteObject(part.into());
            }

            let _ = SetWindowRgn(hwnd, Some(region), true);
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod region {
    use tauri::AppHandle;

    pub fn apply(_app: &AppHandle, _label: &str, _rects: &[[i32; 5]]) {}
}
