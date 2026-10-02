mod launch;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            launch::forward(app, &args, &cwd);
        }))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_eris_terminal::init("/"))
        .invoke_handler(tauri::generate_handler![
            eris_style::commands::eris_style,
            eris_style::commands::system_accent,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let args: Vec<String> = std::env::args().skip(1).collect();
            let cwd = std::env::current_dir().unwrap_or_default();

            eris_style::watch(handle.clone());

            if tauri_plugin_eris_terminal::open_window(&handle, launch::parse(&args, &cwd)).is_err()
            {
                handle.exit(1);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Eris Terminal");
}
