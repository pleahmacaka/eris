use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Deserialize;
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::{Manager, Runtime, State, Window};

use crate::shells;

const READ_CHUNK: usize = 64 * 1024;
const BATCH_LIMIT: usize = 1024 * 1024;
const FRAME: Duration = Duration::from_millis(4);

struct Session {
    window: String,
    master: Box<dyn MasterPty + Send>,
    input: Sender<Vec<u8>>,
    killer: Box<dyn ChildKiller + Send + Sync>,
}

#[derive(Default)]
pub struct Sessions {
    next: AtomicU32,
    open: Mutex<HashMap<u32, Session>>,
}

impl Sessions {
    fn take(&self, id: u32) -> Option<Session> {
        self.open.lock().unwrap().remove(&id)
    }

    pub fn close_window(&self, label: &str) {
        let closing: Vec<Session> = {
            let mut open = self.open.lock().unwrap();
            let ids: Vec<u32> = open
                .iter()
                .filter(|(_, session)| session.window == label)
                .map(|(id, _)| *id)
                .collect();

            ids.iter().filter_map(|id| open.remove(id)).collect()
        };

        for session in closing {
            close(session);
        }
    }
}

// ClosePseudoConsole can wait on conhost, so it never runs on the main thread
fn close(mut session: Session) {
    thread::spawn(move || {
        let _ = session.killer.kill();
        drop(session);
    });
}

fn size(cols: u16, rows: u16) -> PtySize {
    PtySize {
        rows: rows.max(1),
        cols: cols.max(1),
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn feed(mut writer: Box<dyn Write + Send>) -> Sender<Vec<u8>> {
    let (input, queue) = mpsc::channel::<Vec<u8>>();

    thread::spawn(move || {
        for data in queue {
            if writer
                .write_all(&data)
                .and_then(|_| writer.flush())
                .is_err()
            {
                break;
            }
        }
    });

    input
}

fn pump(mut reader: Box<dyn Read + Send>, output: Channel<InvokeResponseBody>) -> JoinHandle<()> {
    let (chunks, queue) = mpsc::channel::<Vec<u8>>();

    thread::spawn(move || {
        let mut buffer = vec![0; READ_CHUNK];

        while let Ok(read) = reader.read(&mut buffer) {
            if read == 0 || chunks.send(buffer[..read].to_vec()).is_err() {
                break;
            }
        }
    });

    thread::spawn(move || {
        let mut sent = Instant::now() - FRAME;

        while let Ok(mut batch) = queue.recv() {
            let deadline = sent + FRAME;

            while batch.len() < BATCH_LIMIT {
                match queue.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                    Ok(more) => batch.extend_from_slice(&more),
                    Err(RecvTimeoutError::Timeout | RecvTimeoutError::Disconnected) => break,
                }
            }

            if output.send(InvokeResponseBody::Raw(batch)).is_err() {
                break;
            }

            sent = Instant::now();
        }
    })
}

#[derive(Deserialize)]
pub struct Spawn {
    shell: String,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
}

#[tauri::command(async)]
pub fn spawn<R: Runtime>(
    window: Window<R>,
    sessions: State<'_, Sessions>,
    spawn: Spawn,
    output: Channel<InvokeResponseBody>,
    exit: Channel<u32>,
) -> Result<u32, String> {
    let shell = shells::find(&spawn.shell).ok_or("unknown shell")?;
    let cwd = spawn.cwd.filter(|dir| Path::new(dir).is_dir());
    let pair = native_pty_system()
        .openpty(size(spawn.cols, spawn.rows))
        .map_err(|e| e.to_string())?;

    let mut command = CommandBuilder::new(&shell.program);

    command.args(shell.args(cwd.is_some()));
    command.env("TERM_PROGRAM", "Eris Terminal");
    command.env("COLORTERM", "truecolor");

    let home = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME"));

    if let Some(dir) = cwd.or_else(|| home.ok()) {
        command.cwd(dir);
    }

    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|e| e.to_string())?;

    drop(pair.slave);

    let reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let id = sessions.next.fetch_add(1, Ordering::Relaxed);

    sessions.open.lock().unwrap().insert(
        id,
        Session {
            window: window.label().to_string(),
            master: pair.master,
            input: feed(writer),
            killer: child.clone_killer(),
        },
    );

    let pumping = pump(reader, output);
    let app = window.app_handle().clone();

    thread::spawn(move || {
        let code = child.wait().map(|status| status.exit_code()).unwrap_or(1);
        let gone = app.state::<Sessions>().take(id);

        drop(gone);

        let _ = pumping.join();
        let _ = exit.send(code);
    });

    Ok(id)
}

#[tauri::command]
pub fn write(sessions: State<'_, Sessions>, id: u32, data: String) {
    if let Some(session) = sessions.open.lock().unwrap().get(&id) {
        let _ = session.input.send(data.into_bytes());
    }
}

#[tauri::command]
pub fn resize(sessions: State<'_, Sessions>, id: u32, cols: u16, rows: u16) {
    if let Some(session) = sessions.open.lock().unwrap().get(&id) {
        let _ = session.master.resize(size(cols, rows));
    }
}

#[tauri::command]
pub fn kill(sessions: State<'_, Sessions>, id: u32) {
    if let Some(session) = sessions.take(id) {
        close(session);
    }
}
