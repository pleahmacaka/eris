//! OS controls, displays, media, and system observation.

pub(crate) mod audio;
pub(crate) mod com;
pub(crate) mod controls;
pub(crate) mod media;
pub(crate) mod meters;
pub(crate) mod monitors;
pub(crate) mod quick;
pub(crate) mod share;
pub(crate) mod spectrum;

// WinRT joins, UAC prompts and shell calls park their thread, so they stay off the async workers
pub(crate) async fn blocking<T: Send + 'static>(
    work: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| e.to_string())?
}
