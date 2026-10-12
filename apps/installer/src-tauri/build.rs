use std::env;
use std::fs;
use std::path::PathBuf;

const COMPONENTS: [(&str, &str, &str); 3] = [
    ("eris", "Eris", "eris"),
    ("files", "Eris Files", "Eris Files"),
    ("terminal", "Eris Terminal", "Eris Terminal"),
];

fn json_string(path: &str, pointer: &str) -> String {
    println!("cargo:rerun-if-changed={path}");

    let text = fs::read_to_string(path).unwrap_or_else(|_| panic!("read {path}"));
    let json: serde_json::Value =
        serde_json::from_str(&text).unwrap_or_else(|_| panic!("parse {path}"));

    json.pointer(pointer)
        .and_then(|value| value.as_str())
        .unwrap_or_else(|| panic!("{pointer} in {path}"))
        .to_string()
}

fn main() {
    println!("cargo:rerun-if-env-changed=ERIS_PAYLOAD");

    let os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let suffix = match os.as_str() {
        "windows" => ".exe",
        "macos" => ".app.tar.gz",
        _ => ".AppImage",
    };
    let strict =
        env::var("PROFILE").as_deref() == Ok("release") || env::var_os("ERIS_PAYLOAD").is_some();
    let dir = env::var("ERIS_PAYLOAD").map_or_else(|_| PathBuf::from("payload"), PathBuf::from);

    let mut code = String::from("pub static APPS: &[App] = &[\n");

    for (id, name, product) in COMPONENTS
        .iter()
        .filter(|(id, ..)| os == "windows" || *id != "eris")
    {
        let path = dir.join(format!("{id}{suffix}"));

        println!("cargo:rerun-if-changed={}", path.display());

        let payload = match path.canonicalize() {
            Ok(path) => format!("Some(include_bytes!({:?}))", path.display().to_string()),
            Err(_) if strict => panic!("missing installer payload {}", path.display()),
            Err(_) => "None".to_string(),
        };

        code += &format!(
            "    App {{ id: {id:?}, name: {name:?}, product: {product:?}, payload: {payload} }},\n"
        );
    }

    let pubkey = json_string(
        "../../desktop/src-tauri/tauri.conf.json",
        "/plugins/updater/pubkey",
    );
    let version = json_string("../package.json", "/version");

    code += "];\n\n";
    code += &format!("pub const PUBKEY: &str = {pubkey:?};\n");
    code += &format!("pub const VERSION: &str = {version:?};\n");

    let out = PathBuf::from(env::var("OUT_DIR").unwrap()).join("payload.rs");

    fs::write(out, code).expect("write payload.rs");

    tauri_build::build()
}
