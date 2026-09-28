mod p2p;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            p2p::start(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            p2p::p2p_status,
            p2p::p2p_invite,
            p2p::p2p_join,
            p2p::p2p_leave,
            p2p::p2p_publish,
            p2p::p2p_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Note");
}
