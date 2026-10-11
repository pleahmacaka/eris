//! Placement only: presentation timing and anchor ownership stay in the parent.

use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};
use tauri_plugin_store::StoreExt;

use crate::shell::appbar;

fn physical_size_on(window: &WebviewWindow, scale: f64) -> tauri::Result<(i32, i32)> {
    let logical = window
        .outer_size()?
        .to_logical::<f64>(window.scale_factor()?);

    Ok((
        (logical.width * scale).round() as i32,
        (logical.height * scale).round() as i32,
    ))
}

pub(super) fn center_on_cursor_monitor(window: &WebviewWindow) -> tauri::Result<()> {
    let cursor = window.cursor_position()?;

    let Some(monitor) = window.monitor_from_point(cursor.x, cursor.y)? else {
        return window.center();
    };

    let work = monitor.work_area();
    let (width, height) = physical_size_on(window, monitor.scale_factor())?;
    let x = work.position.x + ((work.size.width as i32 - width) / 2).max(0);
    let y = work.position.y + ((work.size.height as i32 - height) / 2).max(0);

    window.set_position(PhysicalPosition::new(x, y))
}

pub(super) fn dock_panel(app: &AppHandle, window: &WebviewWindow) -> tauri::Result<()> {
    // the dock window keeps room above its band for menus, so follow the band the appbar reserved
    let anchor = if appbar::topbar_on(app) && appbar::bar_frame("topbar").is_some() {
        "topbar"
    } else {
        "taskbar"
    };

    let dock = appbar::bar_frame(anchor).map(|[left, top, width, height]| {
        (
            PhysicalPosition::new(left, top),
            tauri::PhysicalSize::new(width as u32, height as u32),
        )
    });

    let dock = match dock {
        Some(frame) => Some(frame),
        None => app
            .get_webview_window("taskbar")
            .map(|dock| Ok::<_, tauri::Error>((dock.outer_position()?, dock.outer_size()?)))
            .transpose()?,
    };

    let anchored = match dock {
        Some((position, dock_size)) => window.monitor_from_point(
            f64::from(position.x + dock_size.width as i32 / 2),
            f64::from(position.y + dock_size.height as i32 / 2),
        )?,
        None => None,
    };

    let monitor = match anchored {
        Some(monitor) => Some(monitor),
        None => window.primary_monitor()?,
    };

    let Some(monitor) = monitor else {
        return window.center();
    };

    let scale = monitor.scale_factor();
    let gap = (8.0 * scale).round() as i32;
    let (width, height) = physical_size_on(window, scale)?;
    let screen_right = monitor.position().x + monitor.size().width as i32;
    let screen_bottom = monitor.position().y + monitor.size().height as i32;

    let x = match stored_panel_position(app).as_str() {
        "left" => monitor.position().x + gap,
        "center" => monitor.position().x + (monitor.size().width as i32 - width) / 2,
        _ => screen_right - gap - width,
    };

    let anchor_top = anchor == "topbar" || appbar::edge_is_top();

    let y = match dock {
        Some((position, dock_size)) if anchor_top => position.y + dock_size.height as i32 + gap,
        Some((position, _)) => position.y - gap - height,
        None => screen_bottom - gap - height,
    };

    // the window is wider than its visible cards, so on a narrow screen it hangs off the far edge instead of shifting them
    let y = y
        .min(screen_bottom - gap - height)
        .max(monitor.position().y + gap);

    window.set_position(PhysicalPosition::new(x, y))
}

pub(super) fn anchor_panel(window: &WebviewWindow, anchor: [i32; 4]) -> tauri::Result<()> {
    let [left, top, right, bottom] = anchor;
    let center_x = (left + right) / 2;
    let center_y = (top + bottom) / 2;

    let Some(monitor) = window.monitor_from_point(f64::from(center_x), f64::from(center_y))? else {
        return window.center();
    };

    let [band_top, band_bottom] = ["taskbar", "topbar"]
        .into_iter()
        .filter_map(appbar::bar_frame)
        .find(|[x, y, width, height]| {
            (*x..x + width).contains(&center_x) && (*y..y + height).contains(&center_y)
        })
        .map_or([top, bottom], |[_, y, _, height]| [y, y + height]);

    let scale = monitor.scale_factor();
    let gap = (8.0 * scale).round() as i32;
    let (width, height) = physical_size_on(window, scale)?;
    let screen_left = monitor.position().x;
    let screen_top = monitor.position().y;
    let screen_right = screen_left + monitor.size().width as i32;
    let screen_bottom = screen_top + monitor.size().height as i32;

    let opens_up = center_y > screen_top + monitor.size().height as i32 / 2;
    let y = if opens_up {
        band_top - gap - height
    } else {
        band_bottom + gap
    };
    let x = center_x - width / 2;

    let x = x.min(screen_right - gap - width).max(screen_left + gap);
    let y = y.min(screen_bottom - gap - height).max(screen_top + gap);

    window.set_position(PhysicalPosition::new(x, y))
}

fn stored_panel_position(app: &AppHandle) -> String {
    app.store("settings.json")
        .ok()
        .and_then(|store| store.get("device"))
        .and_then(|device| {
            device
                .get("panelPosition")?
                .as_str()
                .map(std::string::ToString::to_string)
        })
        .unwrap_or_else(|| "right".into())
}
