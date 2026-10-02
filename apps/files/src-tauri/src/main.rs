#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if let Some(code) = files_lib::default_app::cli(&tauri_plugin_eris_files::STANDALONE, &args) {
        std::process::exit(code);
    }

    files_lib::run();
}
