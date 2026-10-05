mod p2p;

const SANDBOX: &[u8] = include_bytes!("sandbox.html");

// note scripts run here; no connect-src keeps them away from the ipc endpoint
const SANDBOX_CSP: &str = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: https:; media-src data: https:; font-src data:";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();

    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        use tauri::Manager;

        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .register_uri_scheme_protocol("sandbox", |_ctx, _request| {
            tauri::http::Response::builder()
                .header("Content-Type", "text/html; charset=utf-8")
                .header("Content-Security-Policy", SANDBOX_CSP)
                .body(SANDBOX.to_vec())
                .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
        })
        .setup(|app| {
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;

                let _ = app.deep_link().register_all();
            }

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
