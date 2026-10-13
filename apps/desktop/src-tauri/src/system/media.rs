use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::AppHandle;

#[derive(Clone, Serialize)]
pub struct MediaStatus {
    pub title: String,
    pub artist: String,
    pub app: String,
    pub playing: bool,
}

// single flight; overlapping polls would stack 1.5 s waits on the blocking pool
static POLL_IN_FLIGHT: AtomicBool = AtomicBool::new(false);
static LAST_STATUS: Mutex<Option<MediaStatus>> = Mutex::new(None);

#[tauri::command]
pub async fn media_status(app: AppHandle) -> Option<MediaStatus> {
    if POLL_IN_FLIGHT.swap(true, Ordering::Relaxed) {
        return LAST_STATUS.lock().unwrap().clone();
    }

    let status = tauri::async_runtime::spawn_blocking(move || win::status(app))
        .await
        .ok()
        .flatten();

    *LAST_STATUS.lock().unwrap() = status.clone();
    POLL_IN_FLIGHT.store(false, Ordering::Relaxed);

    status
}

#[tauri::command]
pub async fn media_command(action: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || win::command(&action))
        .await
        .map_err(|e| e.to_string())?
}

fn app_name(id: &str) -> String {
    if let Some((name, _)) = id
        .rsplit_once('.')
        .filter(|(_, ext)| ext.eq_ignore_ascii_case("exe"))
    {
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

mod win {
    use std::sync::{Mutex, OnceLock};
    use std::thread::sleep;
    use std::time::{Duration, Instant};

    use tauri::{AppHandle, Emitter};
    use windows::Foundation::TypedEventHandler;
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Playback,
    };

    use super::{app_name, MediaStatus};

    struct Bound {
        session: Session,
        properties: i64,
        playback: i64,
    }

    static APP: OnceLock<AppHandle> = OnceLock::new();
    static MANAGER: Mutex<Option<Manager>> = Mutex::new(None);
    static BOUND: Mutex<Option<Bound>> = Mutex::new(None);

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

    fn changed() {
        if let Some(app) = APP.get() {
            let _ = app.emit("media-changed", ());
        }
    }

    fn release(bound: Bound) {
        let _ = bound.session.RemoveMediaPropertiesChanged(bound.properties);
        let _ = bound.session.RemovePlaybackInfoChanged(bound.playback);
    }

    fn bind(manager: &Manager) {
        let current = manager.GetCurrentSession().ok();
        let mut bound = BOUND.lock().unwrap();

        if bound.as_ref().map(|bound| &bound.session) == current.as_ref() {
            return;
        }

        if let Some(old) = bound.take() {
            release(old);
        }

        let Some(session) = current else {
            return;
        };

        let properties = session.MediaPropertiesChanged(&TypedEventHandler::new(|_, _| {
            changed();

            Ok(())
        }));
        let playback = session.PlaybackInfoChanged(&TypedEventHandler::new(|_, _| {
            changed();

            Ok(())
        }));

        if let (Ok(properties), Ok(playback)) = (properties, playback) {
            *bound = Some(Bound {
                session,
                properties,
                playback,
            });
        }
    }

    fn rebind() {
        std::thread::spawn(|| {
            if let Some(manager) = MANAGER.lock().unwrap().clone() {
                bind(&manager);
            }

            changed();
        });
    }

    // the manager owns the change events, so one instance lives for the process instead of one per poll
    fn manager() -> Option<Manager> {
        let mut cached = MANAGER.lock().unwrap();

        if let Some(manager) = cached.as_ref() {
            return Some(manager.clone());
        }

        let manager = settle!(Manager::RequestAsync().ok()?)?;

        manager
            .SessionsChanged(&TypedEventHandler::new(|_, _| {
                rebind();

                Ok(())
            }))
            .ok()?;
        manager
            .CurrentSessionChanged(&TypedEventHandler::new(|_, _| {
                rebind();

                Ok(())
            }))
            .ok()?;

        bind(&manager);
        *cached = Some(manager.clone());

        Some(manager)
    }

    fn forget() {
        *MANAGER.lock().unwrap() = None;

        if let Some(bound) = BOUND.lock().unwrap().take() {
            release(bound);
        }
    }

    pub fn status(app: AppHandle) -> Option<MediaStatus> {
        let _ = APP.set(app);
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
        match manager()?.GetCurrentSession() {
            Ok(session) => Some(session),
            Err(error) => {
                if error.code().is_err() {
                    forget();
                }

                None
            }
        }
    }

    fn text(value: windows::core::Result<windows::core::HSTRING>) -> String {
        value.map(|value| value.to_string()).unwrap_or_default()
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
