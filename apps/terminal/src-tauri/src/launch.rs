use std::path::Path;

use tauri::AppHandle;

pub fn parse(args: &[String], cwd: &Path) -> Option<String> {
    let mut rest = args.iter();
    let mut target = None;

    while let Some(arg) = rest.next() {
        match arg.as_str() {
            "-d" | "--cwd" | "--startingDirectory" => target = rest.next(),
            flag if flag.starts_with('-') => {}
            path => target = target.or(Some(arg)).filter(|_| !path.is_empty()),
        }
    }

    target
        .map(|dir| cwd.join(dir.trim_matches('"')))
        .filter(|dir| dir.is_dir())
        .map(|dir| dir.to_string_lossy().to_string())
}

pub fn forward(app: &AppHandle, args: &[String], cwd: &str) {
    let _ = tauri_plugin_eris_terminal::open_window(
        app,
        parse(args.get(1..).unwrap_or_default(), Path::new(cwd)),
    );
}
