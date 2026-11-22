// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  #[cfg(target_os = "linux")]
  prefer_stable_webkit_backend();
  eris_lib::run();
}

#[cfg(target_os = "linux")]
fn prefer_stable_webkit_backend() {
  let defaults = [
    ("WEBKIT_DISABLE_DMABUF_RENDERER", "1"),
    ("GDK_BACKEND", "x11"),
  ];
  for (key, value) in defaults {
    if key == "GDK_BACKEND" && std::env::var_os("DISPLAY").is_none() {
      continue;
    }
    if std::env::var_os(key).is_none() {
      // WebKitGTK on Wayland reports a negative devicePixelRatio here, and DMA-BUF crashes NVIDIA with protocol error 71
      unsafe { std::env::set_var(key, value) };
    }
  }
}
