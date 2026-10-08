use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Deserialize;
use tauri::ipc::{Channel, InvokeResponseBody, Response};
use tauri::{Manager, Runtime, State, Window};

use crate::shells;

const READ_CHUNK: usize = 64 * 1024;
const BATCH_LIMIT: usize = 1024 * 1024;
const FRAME: Duration = Duration::from_millis(4);
const REPLAY_LIMIT: usize = 1024 * 1024;

#[derive(Default)]
struct Sink {
    output: Option<Channel<InvokeResponseBody>>,
    exit: Option<Channel<u32>>,
    buffer: VecDeque<u8>,
    shown: usize,
}

impl Sink {
    fn push(&mut self, batch: Vec<u8>) {
        self.buffer.extend(&batch);

        if let Some(output) = &self.output {
            let _ = output.send(InvokeResponseBody::Raw(batch));
            self.shown = self.buffer.len();
        }

        self.trim();
    }

    fn trim(&mut self) {
        if self.buffer.len() <= REPLAY_LIMIT {
            return;
        }

        let excess = self.buffer.len() - REPLAY_LIMIT;
        let line = self
            .buffer
            .iter()
            .skip(excess)
            .position(|byte| *byte == b'\n')
            .map_or(0, |at| at + 1);
        let cut = excess + line;

        self.buffer.drain(..cut);
        self.shown = self.shown.saturating_sub(cut);
    }

    fn attach(&mut self, output: Channel<InvokeResponseBody>, exit: Channel<u32>) -> Vec<u8> {
        // ConPTY asks for the cursor position at startup, so unseen output must reach a live screen
        let unseen: Vec<u8> = self.buffer.range(self.shown..).copied().collect();

        if !unseen.is_empty() {
            let _ = output.send(InvokeResponseBody::Raw(unseen));
        }

        let history = self.buffer.range(..self.shown).copied().collect();

        self.shown = self.buffer.len();
        self.output = Some(output);
        self.exit = Some(exit);

        history
    }

    fn detach(&mut self, channel: u32) {
        if self
            .output
            .as_ref()
            .is_some_and(|output| output.id() == channel)
        {
            self.output = None;
            self.exit = None;
        }
    }
}

struct Session {
    window: String,
    master: Box<dyn MasterPty + Send>,
    input: Sender<Vec<u8>>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    sink: Arc<Mutex<Sink>>,
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

fn pump(mut reader: Box<dyn Read + Send>, sink: Arc<Mutex<Sink>>) -> JoinHandle<()> {
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

            sink.lock().unwrap().push(batch);
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
    let sink = Arc::new(Mutex::new(Sink::default()));

    sessions.open.lock().unwrap().insert(
        id,
        Session {
            window: window.label().to_string(),
            master: pair.master,
            input: feed(writer),
            killer: child.clone_killer(),
            sink: sink.clone(),
        },
    );

    let pumping = pump(reader, sink.clone());
    let app = window.app_handle().clone();

    thread::spawn(move || {
        let code = child.wait().map(|status| status.exit_code()).unwrap_or(1);
        let gone = app.state::<Sessions>().take(id);

        drop(gone);

        let _ = pumping.join();

        if let Some(exit) = &sink.lock().unwrap().exit {
            let _ = exit.send(code);
        }
    });

    Ok(id)
}

#[tauri::command]
pub fn attach<R: Runtime>(
    window: Window<R>,
    sessions: State<'_, Sessions>,
    id: u32,
    output: Channel<InvokeResponseBody>,
    exit: Channel<u32>,
) -> Result<Response, String> {
    let mut open = sessions.open.lock().unwrap();
    let session = open.get_mut(&id).ok_or("session ended")?;

    session.window = window.label().to_string();

    let history = session.sink.lock().unwrap().attach(output, exit);

    Ok(Response::new(history))
}

#[tauri::command]
pub fn detach(sessions: State<'_, Sessions>, id: u32, channel: u32) {
    if let Some(session) = sessions.open.lock().unwrap().get(&id) {
        session.sink.lock().unwrap().detach(channel);
    }
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
