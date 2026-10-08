#[cfg(windows)]
mod win;

#[cfg(windows)]
pub fn is_screen_sharing() -> bool {
    win::capture_session_open() || win::share_bar_open() || win::capture_process_running()
}

#[cfg(not(windows))]
pub fn is_screen_sharing() -> bool {
    false
}
