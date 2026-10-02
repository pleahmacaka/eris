use std::path::Path;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Wry};
use windows::Win32::System::Diagnostics::Debug::{SetErrorMode, SEM_FAILCRITICALERRORS};

mod actions;
mod address;
mod audio;
mod com;
pub mod default_app;
pub mod error;
mod launch;
mod listing;
mod network;
mod ops;
mod places;
mod preview;
mod share;
mod thumbs;
mod transcribe;
mod watch;

pub(crate) const IDENTIFIER: &str = "com.arixlab.eris.files";
const SCHEME: &str = "eris-files://";

#[derive(Clone, Copy)]
pub struct Host {
    pub main_route: &'static str,
    pub viewer_route: &'static str,
    pub marker: Option<&'static str>,
    pub app_name: &'static str,
    pub prog_prefix: &'static str,
}

pub const STANDALONE: Host = Host {
    main_route: "/",
    viewer_route: "/viewer",
    marker: None,
    app_name: "Eris Files",
    prog_prefix: "ErisFiles",
};

// the share identity and paired devices must survive moving between the standalone app and Eris
pub(crate) fn data_dir(app: &AppHandle) -> tauri::Result<std::path::PathBuf> {
    Ok(app.path().local_data_dir()?.join(IDENTIFIER))
}

pub fn init(host: Host) -> TauriPlugin<Wry> {
    Builder::new("eris-files")
        .register_asynchronous_uri_scheme_protocol("shell", thumbs::serve)
        .invoke_handler(tauri::generate_handler![
            listing::list_dir,
            listing::list_shell,
            listing::search_dir,
            listing::cancel_search,
            places::known_folders,
            places::drives,
            places::explorer_settings,
            actions::open_item,
            actions::open_with,
            actions::show_properties,
            actions::empty_recycle_bin,
            actions::start_drag,
            actions::native_menu,
            actions::invoke_verb,
            ops::transfer_items,
            ops::delete_items,
            ops::rename_item,
            ops::new_folder,
            ops::set_clipboard,
            ops::paste_items,
            ops::clipboard_has_files,
            preview::allow_preview,
            preview::preview_text,
            preview::model_files,
            preview::open_viewer,
            audio::audio_waveform,
            transcribe::transcribe,
            transcribe::read_transcript,
            transcribe::transcribe_key_status,
            transcribe::save_transcribe_key,
            transcribe::clear_transcribe_key,
            launch::take_intent,
            launch::new_window,
            default_app::default_app_status,
            default_app::set_default_app,
            default_app::open_default_apps,
            watch::watch_dir,
            network::network_places,
            network::reconnect_drive,
            network::disconnect_drive,
            network::map_network_drive,
            network::disconnect_network_drive,
            network::add_network_location,
            address::run_address,
            share::commands::share_state,
            share::commands::share_take_attention,
            share::commands::share_rename_self,
            share::commands::share_invite,
            share::commands::share_join,
            share::commands::share_dismiss_pair,
            share::commands::share_rename_device,
            share::commands::share_remove_device,
            share::commands::share_create,
            share::commands::share_set_public,
            share::commands::share_offer,
            share::commands::share_set_expiry,
            share::commands::share_revoke,
            share::commands::share_open,
            share::commands::share_fetch,
            share::commands::share_files,
            share::commands::share_download,
            share::commands::share_cancel,
            share::commands::share_dismiss,
            share::commands::share_qr,
            share::commands::sync_check,
            share::commands::sync_create,
            share::commands::sync_accept,
            share::commands::sync_decline,
            share::commands::sync_pause,
            share::commands::sync_now,
            share::commands::sync_remove,
        ])
        .setup(move |app, _| {
            // an empty card reader or a dead network drive otherwise raises the shell's "insert a disk" dialog
            unsafe { SetErrorMode(SEM_FAILCRITICALERRORS) };

            app.manage(host);
            app.manage(eris_window_kit::Intents::<launch::Intent>::default());
            share::start(app);

            if !cfg!(debug_assertions) {
                default_app::repoint(&host);
            }

            Ok(())
        })
        .build()
}

pub fn takes_over() -> bool {
    default_app::enabled()
}

pub fn show(app: &AppHandle, target: Option<String>, select: bool) -> bool {
    let cwd = std::env::current_dir().unwrap_or_default();

    launch::open(app, &launch::Launch { target, select }, &cwd)
}

pub fn claims(host: &Host, args: &[String]) -> bool {
    args.iter()
        .any(|arg| host.marker.is_some_and(|marker| arg == marker) || arg.starts_with(SCHEME))
}

pub fn start(app: &AppHandle, mut args: Vec<String>, cwd: &Path) -> bool {
    share::take_links(app, &mut args);

    launch::start(app, &args, cwd)
}

pub fn forward(app: &AppHandle, mut args: Vec<String>, cwd: String) {
    let app = app.clone();

    if share::take_links(&app, &mut args) && args.len() <= 1 && share::focus_window(&app) {
        return;
    }

    std::thread::spawn(move || launch::forward(&app, &args, &cwd));
}
