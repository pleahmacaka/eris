#[cfg(windows)]
use std::path::Path;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Wry};
#[cfg(windows)]
use windows::Win32::System::Diagnostics::Debug::{SetErrorMode, SEM_FAILCRITICALERRORS};

#[cfg(windows)]
mod actions;
#[cfg(windows)]
mod address;
#[cfg(windows)]
mod archive;
mod audio;
#[cfg(windows)]
mod com;
pub mod default_app;
pub mod error;
#[cfg(windows)]
mod launch;
#[cfg(windows)]
mod listing;
#[cfg(windows)]
mod network;
#[cfg(windows)]
mod ops;
#[cfg(windows)]
mod places;
#[cfg(windows)]
mod preview;
mod privacy;
mod share;

pub use share::endpoint_id;
#[cfg(windows)]
mod thumbs;
#[cfg(windows)]
mod transcribe;
#[cfg(windows)]
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
    pub peers: Option<fn(&AppHandle) -> Vec<(String, String)>>,
}

pub const STANDALONE: Host = Host {
    main_route: "/",
    viewer_route: "/viewer",
    marker: None,
    app_name: "Eris Files",
    prog_prefix: "ErisFiles",
    peers: None,
};

// the share identity and paired devices must survive moving between the standalone app and Eris
pub(crate) fn data_dir(app: &AppHandle) -> tauri::Result<std::path::PathBuf> {
    Ok(app.path().local_data_dir()?.join(IDENTIFIER))
}

pub fn init(host: Host) -> TauriPlugin<Wry> {
    let builder = Builder::new("eris-files");

    #[cfg(windows)]
    let builder = builder.register_asynchronous_uri_scheme_protocol("shell", thumbs::serve);

    builder
        .invoke_handler(tauri::generate_handler![
            #[cfg(windows)]
            listing::list_dir,
            #[cfg(windows)]
            listing::list_shell,
            #[cfg(windows)]
            listing::search_dir,
            #[cfg(windows)]
            listing::cancel_search,
            #[cfg(windows)]
            listing::measure_dirs,
            #[cfg(windows)]
            archive::list_archive,
            #[cfg(windows)]
            archive::extract_entry,
            #[cfg(windows)]
            archive::bandizip_available,
            #[cfg(windows)]
            archive::bandizip_job,
            #[cfg(windows)]
            places::known_folders,
            #[cfg(windows)]
            places::drives,
            #[cfg(windows)]
            places::explorer_settings,
            #[cfg(windows)]
            places::wsl_distros,
            privacy::screen_sharing,
            #[cfg(windows)]
            actions::open_item,
            #[cfg(windows)]
            actions::open_with,
            #[cfg(windows)]
            actions::show_properties,
            #[cfg(windows)]
            actions::empty_recycle_bin,
            #[cfg(windows)]
            actions::start_drag,
            #[cfg(windows)]
            actions::native_menu,
            #[cfg(windows)]
            actions::invoke_verb,
            #[cfg(windows)]
            ops::transfer_items,
            #[cfg(windows)]
            ops::delete_items,
            #[cfg(windows)]
            ops::rename_item,
            #[cfg(windows)]
            ops::new_folder,
            #[cfg(windows)]
            ops::set_clipboard,
            #[cfg(windows)]
            ops::paste_items,
            #[cfg(windows)]
            ops::clipboard_has_files,
            #[cfg(windows)]
            preview::allow_preview,
            #[cfg(windows)]
            preview::preview_text,
            #[cfg(windows)]
            preview::model_files,
            #[cfg(windows)]
            preview::is_mujoco,
            #[cfg(windows)]
            preview::open_viewer,
            audio::audio_waveform,
            #[cfg(windows)]
            transcribe::transcribe,
            #[cfg(windows)]
            transcribe::read_transcript,
            #[cfg(windows)]
            transcribe::transcribe_key_status,
            #[cfg(windows)]
            transcribe::save_transcribe_key,
            #[cfg(windows)]
            transcribe::clear_transcribe_key,
            #[cfg(windows)]
            launch::take_intent,
            #[cfg(windows)]
            launch::new_window,
            default_app::default_app_status,
            default_app::set_default_app,
            default_app::open_default_apps,
            #[cfg(windows)]
            watch::watch_dir,
            #[cfg(windows)]
            network::network_places,
            #[cfg(windows)]
            network::reconnect_drive,
            #[cfg(windows)]
            network::disconnect_drive,
            #[cfg(windows)]
            network::map_network_drive,
            #[cfg(windows)]
            network::disconnect_network_drive,
            #[cfg(windows)]
            network::add_network_location,
            #[cfg(windows)]
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
            share::commands::share_browse,
            share::commands::share_browse_fetch,
            share::commands::share_browse_answer,
            share::commands::share_browse_revoke,
            share::commands::share_browse_scope,
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
            #[cfg(windows)]
            unsafe {
                SetErrorMode(SEM_FAILCRITICALERRORS)
            };

            app.manage(host);
            #[cfg(windows)]
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

#[cfg(windows)]
pub fn show(app: &AppHandle, target: Option<String>, select: bool) -> bool {
    let cwd = std::env::current_dir().unwrap_or_default();

    launch::open(app, &launch::Launch { target, select }, &cwd)
}

pub fn claims(host: &Host, args: &[String]) -> bool {
    args.iter()
        .any(|arg| host.marker.is_some_and(|marker| arg == marker) || arg.starts_with(SCHEME))
}

#[cfg(windows)]
pub fn start(app: &AppHandle, mut args: Vec<String>, cwd: &Path) -> bool {
    share::take_links(app, &mut args);

    launch::start(app, &args, cwd)
}

#[cfg(windows)]
pub fn forward(app: &AppHandle, mut args: Vec<String>, cwd: String) {
    let app = app.clone();

    if share::take_links(&app, &mut args) && args.len() <= 1 && share::focus_window(&app) {
        return;
    }

    std::thread::spawn(move || launch::forward(&app, &args, &cwd));
}
