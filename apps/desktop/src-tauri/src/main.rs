// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let mut args = std::env::args().skip(1);

    while let Some(arg) = args.next() {
        if arg == "--usage-bridge" {
            let chain = args
                .find(|next| next == "--chain")
                .and_then(|_| args.next());

            return app_lib::usage_bridge(chain);
        }
    }

    app_lib::run();
}
