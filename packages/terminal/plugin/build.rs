const COMMANDS: &[&str] = &[
    "spawn",
    "write",
    "resize",
    "kill",
    "attach",
    "detach",
    "claude_chat",
    "claude_transcript",
    "claude_commands",
    "shells",
    "serial_ports",
    "take_intent",
    "new_window",
    "register_host",
    "tear_off",
    "drag_hover",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
