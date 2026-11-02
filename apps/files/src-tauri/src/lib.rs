#[cfg(windows)]
use windows::Win32::UI::WindowsAndMessaging::{AllowSetForegroundWindow, ASFW_ANY};

pub use tauri_plugin_eris_files::default_app;

const QUIET_LOGS: [&str; 5] = ["iroh", "iroh_quinn", "iroh_relay", "netwatch", "portmapper"];

fn logger() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    QUIET_LOGS
        .iter()
        .fold(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Warn)
                .level_for("files_lib", log::LevelFilter::Info),
            |builder, target| builder.level_for(*target, log::LevelFilter::Error),
        )
        .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
        .max_file_size(1_000_000)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // the instance that receives forwarded arguments may only raise its window with this grant
    #[cfg(windows)]
    let _ = unsafe { AllowSetForegroundWindow(ASFW_ANY) };

    tauri_plugin_eris_files::log_panics();

    let builder = tauri::Builder::default()
        .plugin(logger())
        .plugin(eris_window_kit::development());

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
            log::info!(
                "Eris Files {} started on {} {}",
                app.package_info().version,
                std::env::consts::OS,
                std::env::consts::ARCH
            );

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
