use tauri::AppHandle;
use tauri_plugin_eris_files::Host;

pub const HOST: Host = Host {
    main_route: "/files",
    viewer_route: "/files/viewer",
    marker: Some("--files"),
    app_name: "Eris",
    prog_prefix: "Eris",
};

pub fn open_instead(app: &AppHandle, reveal: Option<String>) -> bool {
    let select = reveal.is_some();

    tauri_plugin_eris_files::takes_over() && tauri_plugin_eris_files::show(app, reveal, select)
}
