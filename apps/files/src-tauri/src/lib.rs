#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{AllowSetForegroundWindow, ASFW_ANY};

pub use tauri_plugin_eris_files::default_app;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // the instance that receives forwarded arguments may only raise its window with this grant
    #[cfg(windows)]
    let _ = unsafe { AllowSetForegroundWindow(ASFW_ANY) };

    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
        tauri_plugin_eris_files::forward(app, args, cwd);
    }));

    let builder = builder.plugin(tauri_plugin_deep_link::init());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_eris_auth::init("eris-files"))
        .plugin(tauri_plugin_eris_terminal::init("/terminal"));

    let builder = builder
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(windows)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        eris_style::commands::eris_style,
        eris_style::commands::system_accent
    ]);

    #[cfg(mobile)]
    let builder = builder.plugin(tauri_plugin_barcode_scanner::init());

    builder
        .plugin(tauri_plugin_eris_files::init(
            tauri_plugin_eris_files::STANDALONE,
        ))
        .setup(|app| {
            #[cfg(windows)]
            eris_style::watch(app.handle().clone());

            #[cfg(desktop)]
            {
                let args: Vec<String> = std::env::args().skip(1).collect();
                let cwd = std::env::current_dir().unwrap_or_default();

                if !tauri_plugin_eris_files::start(app.handle(), args, &cwd) {
                    app.handle().exit(0);
                }
            }

            #[cfg(mobile)]
            let _ = app;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Eris Files");
}
