use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;

#[derive(Serialize)]
pub struct MediaStatus {
    pub title: String,
    pub artist: String,
    pub app: String,
    pub playing: bool,
}

// ponytail: single flight; overlapping polls would stack 1.5 s waits on the blocking pool
static POLL_IN_FLIGHT: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub async fn media_status() -> Option<MediaStatus> {
    if POLL_IN_FLIGHT.swap(true, Ordering::Relaxed) {
        return None;
    }

    let status = tauri::async_runtime::spawn_blocking(win::status).await;

    POLL_IN_FLIGHT.store(false, Ordering::Relaxed);

    status.ok().flatten()
}

#[tauri::command]
pub async fn media_command(action: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || win::command(&action))
        .await
        .map_err(|e| e.to_string())?
}

fn app_name(id: &str) -> String {
    if let Some(name) = id.strip_suffix(".exe") {
        return name.to_string();
    }

    let tail = id.rsplit('!').next().unwrap_or(id);
    let package = tail.split('_').next().unwrap_or(tail);
    let name = package.rsplit('.').next().unwrap_or(package);

    let hashed = name.len() >= 8
        && name
            .chars()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_lowercase());

    if hashed {
        return String::new();
    }

    name.to_string()
}

#[cfg(target_os = "windows")]
mod win {
    use std::thread::sleep;
    use std::time::{Duration, Instant};

    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Playback,
    };

    use super::{app_name, MediaStatus};

    const BUDGET: Duration = Duration::from_millis(1500);
    const STEP: Duration = Duration::from_millis(5);

    // IAsyncOperation::get() waits INFINITE, so a stalled SMTC provider parks the thread for good
    macro_rules! settle {
        ($operation:expr) => {{
            let operation = $operation;
            let deadline = Instant::now() + BUDGET;

            loop {
                match operation.Status().map(|status| status.0) {
                    Ok(0) if Instant::now() < deadline => sleep(STEP),
                    Ok(0) | Err(_) => {
                        let _ = operation.Cancel();

                        break None;
                    }
                    Ok(_) => break operation.GetResults().ok(),
                }
            }
        }};
    }

    pub fn status() -> Option<MediaStatus> {
        let session = session()?;
        let properties = settle!(session.TryGetMediaPropertiesAsync().ok()?)?;
        let title = properties.Title().ok()?.to_string();

        if title.is_empty() {
            return None;
        }

        let playback = session
            .GetPlaybackInfo()
            .and_then(|info| info.PlaybackStatus())
            .unwrap_or(Playback::Closed);

        Some(MediaStatus {
            title,
            artist: text(properties.Artist()),
            app: app_name(&text(session.SourceAppUserModelId())),
            playing: playback == Playback::Playing,
        })
    }

    pub fn command(action: &str) -> Result<(), String> {
        let session = session().ok_or("no active media session")?;

        let request = match action {
            "playpause" => session.TryTogglePlayPauseAsync(),
            "next" => session.TrySkipNextAsync(),
            "previous" => session.TrySkipPreviousAsync(),
            "stop" => session.TryStopAsync(),
            other => return Err(format!("unknown media action {other}")),
        };

        match settle!(request.map_err(|e| e.to_string())?) {
            Some(true) => Ok(()),
            Some(false) => Err(format!("session rejected {action}")),
            None => Err(format!("media session did not answer {action}")),
        }
    }

    fn session() -> Option<Session> {
        settle!(Manager::RequestAsync().ok()?)?
            .GetCurrentSession()
            .ok()
    }

    fn text(value: windows::core::Result<windows::core::HSTRING>) -> String {
        value.map(|value| value.to_string()).unwrap_or_default()
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::MediaStatus;

    pub fn status() -> Option<MediaStatus> {
        None
    }

    pub fn command(_action: &str) -> Result<(), String> {
        Err("unsupported platform".into())
    }
}

#[cfg(test)]
mod tests {
    use super::app_name;

    #[test]
    fn app_name_reads_executables_and_package_ids() {
        assert_eq!(app_name("Spotify.exe"), "Spotify");
        assert_eq!(
            app_name("SpotifyAB.SpotifyMusic_zpdnekdrzrea0!Spotify"),
            "Spotify"
        );
        assert_eq!(
            app_name("Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic"),
            "ZuneMusic"
        );
        assert_eq!(app_name("308046B0AF4A39CB"), "");
        assert_eq!(app_name(""), "");
    }
}
