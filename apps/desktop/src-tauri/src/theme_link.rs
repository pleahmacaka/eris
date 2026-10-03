use std::sync::Mutex;

use tauri::{AppHandle, Emitter};

const PREFIX: &str = "eris://theme";

static PENDING: Mutex<Option<String>> = Mutex::new(None);

pub fn link(args: &[String]) -> Option<String> {
    args.iter().find(|arg| arg.starts_with(PREFIX)).cloned()
}

pub fn accept(app: &AppHandle, link: String) {
    *PENDING.lock().unwrap() = Some(link);

    crate::windowing::show(app, "settings");

    let _ = app.emit("eris-theme-link", ());
}

#[tauri::command]
pub fn take_theme_link() -> Option<String> {
    PENDING.lock().unwrap().take()
}

#[cfg(test)]
mod tests {
    use super::link;

    #[test]
    fn finds_only_theme_links() {
        let args = |list: &[&str]| list.iter().map(|arg| arg.to_string()).collect::<Vec<_>>();

        assert_eq!(
            link(&args(&["eris.exe", "eris://theme?name=Paper"])),
            Some("eris://theme?name=Paper".to_string())
        );
        assert_eq!(
            link(&args(&["eris.exe", "eris://auth/callback?code=1"])),
            None
        );
    }
}
