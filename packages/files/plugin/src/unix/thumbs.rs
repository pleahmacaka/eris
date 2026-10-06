use percent_encoding::percent_decode_str;
use tauri::http::{Request, Response};
use tauri::{UriSchemeContext, UriSchemeResponder, Wry};

use crate::listing::extension;

const IMAGE_LIMIT: u64 = 24 * 1024 * 1024;

fn mime(extension: &str) -> Option<&'static str> {
    Some(match extension {
        ".png" => "image/png",
        ".jpg" | ".jpeg" => "image/jpeg",
        ".gif" => "image/gif",
        ".webp" => "image/webp",
        ".bmp" => "image/bmp",
        ".avif" => "image/avif",
        ".svg" => "image/svg+xml",
        _ => return None,
    })
}

fn missing() -> Response<Vec<u8>> {
    Response::builder().status(404).body(Vec::new()).unwrap()
}

// the webview scales the picture itself, so a thumbnail is the image file as it is
fn picture(key: &str) -> Option<Response<Vec<u8>>> {
    let kind = mime(&extension(key))?;
    let meta = std::fs::metadata(key).ok()?;

    if !meta.is_file() || meta.len() > IMAGE_LIMIT {
        return None;
    }

    let bytes = std::fs::read(key).ok()?;

    Response::builder()
        .header("Content-Type", kind)
        .header("Cache-Control", "max-age=3600")
        .body(bytes)
        .ok()
}

pub fn serve(
    _: UriSchemeContext<'_, Wry>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let raw = request.uri().path().trim_start_matches('/');
    let decoded = percent_decode_str(raw).decode_utf8_lossy().to_string();
    let mut parts = decoded.splitn(3, '/');

    let reply = match (parts.next(), parts.next(), parts.next()) {
        (Some("thumb"), Some(_), Some(key)) => {
            let key = key.to_string();

            std::thread::spawn(move || responder.respond(picture(&key).unwrap_or_else(missing)));

            return;
        }
        _ => missing(),
    };

    responder.respond(reply);
}
