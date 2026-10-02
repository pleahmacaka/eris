const COMMANDS: &[&str] = &[
    "spawn",
    "write",
    "resize",
    "kill",
    "shells",
    "take_intent",
    "new_window",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
