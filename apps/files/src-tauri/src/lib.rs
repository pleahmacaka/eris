use windows::Win32::UI::WindowsAndMessaging::{AllowSetForegroundWindow, ASFW_ANY};

pub use tauri_plugin_eris_files::default_app;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // the instance that receives forwarded arguments may only raise its window with this grant
    let _ = unsafe { AllowSetForegroundWindow(ASFW_ANY) };

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            tauri_plugin_eris_files::forward(app, args, cwd);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_eris_auth::init("eris-files"))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_eris_terminal::init("/terminal"))
        .plugin(tauri_plugin_eris_files::init(
            tauri_plugin_eris_files::STANDALONE,
        ))
        .invoke_handler(tauri::generate_handler![
            eris_style::commands::eris_style,
            eris_style::commands::system_accent
        ])
        .setup(|app| {
            eris_style::watch(app.handle().clone());

            let args: Vec<String> = std::env::args().skip(1).collect();
            let cwd = std::env::current_dir().unwrap_or_default();

            if !tauri_plugin_eris_files::start(app.handle(), args, &cwd) {
                app.handle().exit(0);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Eris Files");
}
