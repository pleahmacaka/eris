#[cfg(desktop)]
use std::path::Path;

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{AppHandle, Manager, Wry};
#[cfg(windows)]
use windows::Win32::System::Diagnostics::Debug::{SetErrorMode, SEM_FAILCRITICALERRORS};

#[cfg(desktop)]
#[cfg_attr(not(windows), path = "unix/actions.rs")]
mod actions;
#[cfg(desktop)]
#[cfg_attr(not(windows), path = "unix/address.rs")]
mod address;
#[cfg(desktop)]
mod archive;
mod audio;
#[cfg(windows)]
mod com;
pub mod default_app;
pub mod error;
#[cfg(desktop)]
mod launch;
#[cfg(desktop)]
#[cfg_attr(not(windows), path = "unix/listing.rs")]
mod listing;
#[cfg(desktop)]
#[cfg_attr(not(windows), path = "unix/network.rs")]
mod network;
#[cfg(desktop)]
#[cfg_attr(not(windows), path = "unix/ops.rs")]
mod ops;
#[cfg(desktop)]
#[cfg_attr(not(windows), path = "unix/places.rs")]
mod places;
#[cfg(desktop)]
mod preview;
mod privacy;
mod share;

pub use share::endpoint_id;
#[cfg(desktop)]
#[cfg_attr(not(windows), path = "unix/thumbs.rs")]
mod thumbs;
#[cfg(desktop)]
mod transcribe;
#[cfg(desktop)]
#[cfg_attr(not(windows), path = "unix/watch.rs")]
mod watch;

pub(crate) const IDENTIFIER: &str = "com.arixlab.eris.files";
const SCHEME: &str = "eris-files://";

pub type PeerList = fn(&AppHandle) -> Vec<(String, String)>;

#[derive(Clone, Copy)]
pub struct Host {
    pub main_route: &'static str,
    pub viewer_route: &'static str,
    pub marker: Option<&'static str>,
    pub app_name: &'static str,
    pub prog_prefix: &'static str,
    pub peers: Option<PeerList>,
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

    #[cfg(desktop)]
    let builder = builder.register_asynchronous_uri_scheme_protocol("shell", thumbs::serve);

    builder
        .invoke_handler(tauri::generate_handler![
            #[cfg(desktop)]
            listing::list_dir,
            #[cfg(desktop)]
            listing::list_shell,
            #[cfg(desktop)]
            listing::search_dir,
            #[cfg(desktop)]
            listing::cancel_search,
            #[cfg(desktop)]
            listing::measure_dirs,
            #[cfg(desktop)]
            archive::list_archive,
            #[cfg(desktop)]
            archive::extract_entry,
            #[cfg(desktop)]
            archive::bandizip_available,
            #[cfg(desktop)]
            archive::bandizip_job,
            #[cfg(desktop)]
            places::known_folders,
            #[cfg(desktop)]
            places::drives,
            #[cfg(desktop)]
            places::explorer_settings,
            #[cfg(desktop)]
            places::wsl_distros,
            privacy::screen_sharing,
            #[cfg(desktop)]
            actions::open_item,
            #[cfg(desktop)]
            actions::open_with,
            #[cfg(desktop)]
            actions::show_properties,
            #[cfg(desktop)]
            actions::empty_recycle_bin,
            #[cfg(desktop)]
            actions::start_drag,
            #[cfg(desktop)]
            actions::native_menu,
            #[cfg(desktop)]
            actions::invoke_verb,
            #[cfg(desktop)]
            ops::transfer_items,
            #[cfg(desktop)]
            ops::delete_items,
            #[cfg(desktop)]
            ops::rename_item,
            #[cfg(desktop)]
            ops::new_folder,
            #[cfg(desktop)]
            ops::set_clipboard,
            #[cfg(desktop)]
            ops::paste_items,
            #[cfg(desktop)]
            ops::clipboard_has_files,
            #[cfg(desktop)]
            preview::allow_preview,
            #[cfg(desktop)]
            preview::preview_text,
            #[cfg(desktop)]
            preview::model_files,
            #[cfg(desktop)]
            preview::is_mujoco,
            #[cfg(desktop)]
            preview::open_viewer,
            audio::audio_waveform,
            #[cfg(desktop)]
            transcribe::transcribe,
            #[cfg(desktop)]
            transcribe::read_transcript,
            #[cfg(desktop)]
            transcribe::transcribe_key_status,
            #[cfg(desktop)]
            transcribe::save_transcribe_key,
            #[cfg(desktop)]
            transcribe::clear_transcribe_key,
            #[cfg(desktop)]
            launch::take_intent,
            #[cfg(desktop)]
            launch::new_window,
            default_app::default_app_status,
            default_app::set_default_app,
            default_app::open_default_apps,
            #[cfg(desktop)]
            watch::watch_dir,
            #[cfg(desktop)]
            network::network_places,
            #[cfg(desktop)]
            network::reconnect_drive,
            #[cfg(desktop)]
            network::disconnect_drive,
            #[cfg(desktop)]
            network::map_network_drive,
            #[cfg(desktop)]
            network::disconnect_network_drive,
            #[cfg(desktop)]
            network::add_network_location,
            #[cfg(desktop)]
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
            #[cfg(desktop)]
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

#[cfg(desktop)]
pub fn show(app: &AppHandle, target: Option<String>, select: bool) -> bool {
    let cwd = std::env::current_dir().unwrap_or_default();

    launch::open(app, &launch::Launch { target, select }, &cwd)
}

pub fn claims(host: &Host, args: &[String]) -> bool {
    args.iter()
        .any(|arg| host.marker.is_some_and(|marker| arg == marker) || arg.starts_with(SCHEME))
}

#[cfg(desktop)]
pub fn start(app: &AppHandle, mut args: Vec<String>, cwd: &Path) -> bool {
    share::take_links(app, &mut args);

    launch::start(app, &args, cwd)
}

#[cfg(desktop)]
pub fn forward(app: &AppHandle, mut args: Vec<String>, cwd: String) {
    let app = app.clone();

    if share::take_links(&app, &mut args) && args.len() <= 1 && share::focus_window(&app) {
        return;
    }

    std::thread::spawn(move || launch::forward(&app, &args, &cwd));
}
