use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Runtime, WindowEvent};

mod pty;
mod shells;
mod windows;

pub use windows::open_window;

pub fn init<R: Runtime>(route: &str) -> TauriPlugin<R> {
    let route = route.to_string();

    Builder::new("eris-terminal")
        .invoke_handler(tauri::generate_handler![
            pty::spawn,
            pty::write,
            pty::resize,
            pty::kill,
            shells::shells,
            windows::take_intent,
            windows::new_window,
        ])
        .setup(move |app, _| {
            app.manage(pty::Sessions::default());
            app.manage(eris_window_kit::Intents::<windows::Intent>::default());
            app.manage(windows::Host { route });

            Ok(())
        })
        .on_window_ready(|window| {
            let label = window.label().to_string();
            let app = window.app_handle().clone();

            window.on_window_event(move |event| {
                if let WindowEvent::Destroyed = event {
                    app.state::<pty::Sessions>().close_window(&label);
                }
            });
        })
        .build()
}
