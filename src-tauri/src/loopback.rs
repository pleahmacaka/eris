use std::io::{BufRead, BufReader, ErrorKind, Write};
use std::net::{TcpListener, TcpStream};
use std::thread;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

pub const CALLBACK_EVENT: &str = "oauth-callback";

const CALLBACK_PATH: &str = "/callback";
const WAIT_LIMIT: Duration = Duration::from_secs(600);
const ACCEPT_POLL: Duration = Duration::from_millis(200);
const READ_LIMIT: Duration = Duration::from_secs(5);

#[tauri::command]
pub fn oauth_loopback_start(app: AppHandle, title: String, body: String) -> Result<u16, String> {
  let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|error| error.to_string())?;
  let port = listener.local_addr().map_err(|error| error.to_string())?.port();
  let page = render_page(&title, &body);

  thread::spawn(move || {
    if let Some(url) = serve_once(&listener, port, &page, Instant::now() + WAIT_LIMIT)
      && let Err(error) = app.emit(CALLBACK_EVENT, url)
    {
      log::warn!("oauth callback not delivered: {error}");
    }
  });

  Ok(port)
}

pub fn serve_once(listener: &TcpListener, port: u16, page: &str, deadline: Instant) -> Option<String> {
  listener.set_nonblocking(true).ok()?;

  while Instant::now() < deadline {
    match listener.accept() {
      Ok((stream, _)) => {
        if let Some(url) = answer(stream, port, page) {
          return Some(url);
        }
      }
      Err(error) if error.kind() == ErrorKind::WouldBlock => thread::sleep(ACCEPT_POLL),
      Err(error) => {
        log::warn!("oauth loopback listener failed: {error}");
        return None;
      }
    }
  }

  None
}

fn answer(mut stream: TcpStream, port: u16, page: &str) -> Option<String> {
  stream.set_nonblocking(false).ok()?;
  stream.set_read_timeout(Some(READ_LIMIT)).ok()?;

  let mut reader = BufReader::new(&stream);
  let mut request_line = String::new();

  reader.read_line(&mut request_line).ok()?;

  let mut header = String::new();

  while reader.read_line(&mut header).ok()? > 2 {
    header.clear();
  }

  let target = request_line
    .strip_prefix("GET ")
    .and_then(|rest| rest.split(' ').next())
    .filter(|target| {
      *target == CALLBACK_PATH || target.starts_with(&format!("{CALLBACK_PATH}?"))
    });

  let Some(target) = target else {
    let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    return None;
  };

  let response = format!(
    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{page}",
    page.len()
  );
  let _ = stream.write_all(response.as_bytes());

  Some(format!("http://127.0.0.1:{port}{target}"))
}

fn escape(text: &str) -> String {
  text
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
    .replace('"', "&quot;")
}

fn render_page(title: &str, body: &str) -> String {
  let title = escape(title);
  let body = escape(body);

  format!(
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width\"><title>{title}</title><style>body{{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#0f0f12;color:#ececf1}}main{{max-width:28rem;padding:2rem;border:1px solid #ffffff1a;border-radius:1rem;text-align:center}}h1{{margin:0 0 .5rem;font-size:1.5rem}}p{{margin:0;color:#a1a1aa}}</style></head><body><main><h1>{title}</h1><p>{body}</p></main></body></html>"
  )
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::io::Read;

  fn request(port: u16, path: &str) -> String {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
    stream
      .write_all(format!("GET {path} HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n").as_bytes())
      .unwrap();
    let mut response = String::new();
    stream.read_to_string(&mut response).unwrap();
    response
  }

  #[test]
  fn returns_the_callback_url_and_serves_the_page() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let port = listener.local_addr().unwrap().port();
    let page = render_page("Done <ok>", "Close this tab");
    let server = thread::spawn(move || {
      serve_once(&listener, port, &page, Instant::now() + Duration::from_secs(10))
    });

    let missing = request(port, "/favicon.ico");
    let found = request(port, "/callback?code=abc&state=xyz");

    assert!(missing.starts_with("HTTP/1.1 404"));
    assert!(found.starts_with("HTTP/1.1 200"));
    assert!(found.contains("Done &lt;ok&gt;"));
    assert_eq!(
      server.join().unwrap(),
      Some(format!("http://127.0.0.1:{port}/callback?code=abc&state=xyz"))
    );
  }

  #[test]
  fn gives_up_at_the_deadline() {
    let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let port = listener.local_addr().unwrap().port();

    assert_eq!(serve_once(&listener, port, "", Instant::now()), None);
  }
}
