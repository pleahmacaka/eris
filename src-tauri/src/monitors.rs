use serde::Serialize;
use tauri::{AppHandle, Monitor, WebviewWindow};

#[derive(Serialize)]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub primary: bool,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale: f64,
}

#[tauri::command]
pub fn list_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    collect(&app).map_err(|e| e.to_string())
}

fn collect(app: &AppHandle) -> tauri::Result<Vec<MonitorInfo>> {
    let primary = app
        .primary_monitor()?
        .and_then(|monitor| monitor.name().cloned());

    Ok(app
        .available_monitors()?
        .iter()
        .enumerate()
        .map(|(index, monitor)| describe(monitor, index, primary.as_deref()))
        .collect())
}

fn describe(monitor: &Monitor, index: usize, primary: Option<&str>) -> MonitorInfo {
    let id = monitor
        .name()
        .cloned()
        .unwrap_or_else(|| format!("display-{}", index + 1));
    let position = monitor.position();
    let size = monitor.size();

    MonitorInfo {
        name: friendly_name(&id, index),
        primary: primary == Some(id.as_str()),
        id,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        scale: monitor.scale_factor(),
    }
}

fn friendly_name(id: &str, index: usize) -> String {
    let trimmed = id.trim_start_matches(r"\\.\").trim_start_matches("DISPLAY");

    match trimmed.parse::<u32>() {
        Ok(number) => format!("Display {number}"),
        Err(_) if id.is_empty() => format!("Display {}", index + 1),
        Err(_) => id.to_string(),
    }
}

pub fn resolve(window: &WebviewWindow, id: Option<&str>) -> tauri::Result<Option<Monitor>> {
    if let Some(id) = id {
        let matched = window
            .available_monitors()?
            .into_iter()
            .find(|monitor| monitor.name().is_some_and(|name| name == id));

        if matched.is_some() {
            return Ok(matched);
        }
    }

    window.primary_monitor()
}

pub fn bounds(monitor: &Monitor) -> [i32; 4] {
    let position = monitor.position();
    let size = monitor.size();

    [
        position.x,
        position.y,
        position.x + size.width as i32,
        position.y + size.height as i32,
    ]
}

#[cfg(test)]
mod tests {
    use super::friendly_name;

    #[test]
    fn device_names_read_as_display_numbers() {
        assert_eq!(friendly_name(r"\\.\DISPLAY1", 0), "Display 1");
        assert_eq!(friendly_name(r"\\.\DISPLAY12", 3), "Display 12");
        assert_eq!(friendly_name("display-2", 1), "display-2");
        assert_eq!(friendly_name("", 4), "Display 5");
    }
}
