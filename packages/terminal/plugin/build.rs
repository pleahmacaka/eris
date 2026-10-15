const COMMANDS: &[&str] = &[
    "spawn",
    "write",
    "resize",
    "kill",
    "attach",
    "detach",
    "shells",
    "serial_ports",
    "take_intent",
    "new_window",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
