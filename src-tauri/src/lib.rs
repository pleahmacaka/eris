#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      #[cfg(target_os = "linux")]
      allow_microphone_in_webkitgtk(app)?;

      #[cfg(windows)]
      allow_microphone_in_webview2(app)?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}

#[cfg(windows)]
fn allow_microphone_in_webview2(app: &tauri::App) -> tauri::Result<()> {
  use tauri::Manager;
  use webview2_com::Microsoft::Web::WebView2::Win32::{
    COREWEBVIEW2_PERMISSION_KIND, COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
    COREWEBVIEW2_PERMISSION_STATE_ALLOW,
  };
  use webview2_com::{PermissionRequestedEventHandler, take_pwstr};
  use windows::core::PWSTR;

  const APP_ORIGINS: [&str; 3] = [
    "http://tauri.localhost/",
    "https://tauri.localhost/",
    "http://localhost:1420/",
  ];

  for window in app.webview_windows().into_values() {
    window.with_webview(|webview| unsafe {
      let Ok(core) = webview.controller().CoreWebView2() else {
        return;
      };
      let mut token = Default::default();
      let handler = PermissionRequestedEventHandler::create(Box::new(|_, args| {
        let Some(args) = args else { return Ok(()) };
        let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
        let mut uri = PWSTR::null();

        args.PermissionKind(&mut kind)?;
        args.Uri(&mut uri)?;

        let uri = take_pwstr(uri);

        if kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE
          && APP_ORIGINS.iter().any(|origin| uri.starts_with(origin))
        {
          args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
        }

        Ok(())
      }));

      if let Err(error) = core.add_PermissionRequested(&handler, &mut token) {
        log::warn!("microphone permission handler not installed: {error}");
      }
    })?;
  }

  Ok(())
}

#[cfg(target_os = "linux")]
fn allow_microphone_in_webkitgtk(app: &tauri::App) -> tauri::Result<()> {
  use tauri::Manager;
  use webkit2gtk::glib::prelude::Cast;
  use webkit2gtk::{
    PermissionRequestExt, SettingsExt, UserMediaPermissionRequest,
    UserMediaPermissionRequestExt, WebViewExt,
  };

  for window in app.webview_windows().into_values() {
    window.with_webview(|webview| {
      let view = webview.inner();

      // WebKitGTK ships getUserMedia and WebRTC disabled, and wry only answers permission requests when a handler is configured
      if let Some(settings) = WebViewExt::settings(&view) {
        settings.set_enable_media_stream(true);
        settings.set_enable_webrtc(true);
      }

      view.connect_permission_request(|_, request| {
        let Some(media) = request.downcast_ref::<UserMediaPermissionRequest>() else {
          return false;
        };

        if media.is_for_audio_device() && !media.is_for_video_device() {
          request.allow();
          return true;
        }

        false
      });
    })?;
  }

  Ok(())
}
