use tauri::menu::MenuBuilder;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::AppHandle;

use crate::windowing;

pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let menu = MenuBuilder::new(app)
        .text("launcher", "Launcher")
        .text("calendar", "Calendar")
        .text("settings", "Settings")
        .separator()
        .text("quit", "Quit")
        .build()?;

    TrayIconBuilder::with_id("eris")
        .icon(tauri::include_image!("icons/icon.png"))
        .tooltip("Eris")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "launcher" => windowing::toggle(app, "main"),
            "calendar" => windowing::toggle(app, "panel"),
            "settings" => windowing::show(app, "settings"),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            let left_click = matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            );

            if left_click {
                windowing::toggle(tray.app_handle(), "main");
            }
        })
        .build(app)?;

    Ok(())
}
