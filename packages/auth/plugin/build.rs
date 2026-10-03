const COMMANDS: &[&str] = &[
    "load",
    "store",
    "forget",
    "redirect",
    "take_callback",
    "open_authorize",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
