use std::fs::{File, OpenOptions, TryLockError};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

const START_TIMEOUT: Duration = Duration::from_secs(40);
const STOP_TIMEOUT: Duration = Duration::from_secs(10);
const POLL: Duration = Duration::from_millis(200);

pub struct Paths {
    pub dir: PathBuf,
}

impl Paths {
    pub fn code(&self) -> PathBuf {
        self.dir.join("code")
    }

    pub fn pid(&self) -> PathBuf {
        self.dir.join("serve.pid")
    }

    pub fn log(&self) -> PathBuf {
        self.dir.join("serve.log")
    }

    fn try_lock(&self) -> Result<Option<File>, String> {
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .write(true)
            .open(self.dir.join("serve.lock"))
            .map_err(|e| e.to_string())?;

        match lock.try_lock() {
            Ok(()) => Ok(Some(lock)),
            Err(TryLockError::WouldBlock) => Ok(None),
            Err(TryLockError::Error(error)) => Err(format!("cannot lock the data folder: {error}")),
        }
    }

    pub fn hold_lock(&self) -> Result<File, String> {
        self.try_lock()?
            .ok_or_else(|| "another sync server already runs for this folder".into())
    }

    fn running(&self) -> Result<bool, String> {
        Ok(self.try_lock()?.is_none())
    }

    pub fn read_code(&self) -> Option<String> {
        let code = std::fs::read_to_string(self.code()).ok()?;

        Some(code.trim().to_string()).filter(|code| !code.is_empty())
    }
}

fn detach(command: &mut Command) {
    #[cfg(unix)]
    std::os::unix::process::CommandExt::process_group(command, 0);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;

        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

        command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
    }
}

fn spawn_server(paths: &Paths) -> Result<Child, String> {
    let mut options = OpenOptions::new();

    options.create(true).append(true);

    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);

    let log = options.open(paths.log()).map_err(|e| e.to_string())?;
    let mut command = Command::new(std::env::current_exe().map_err(|e| e.to_string())?);

    command
        .arg("--dir")
        .arg(&paths.dir)
        .args(["sync", "serve"])
        .stdin(Stdio::null())
        .stdout(log.try_clone().map_err(|e| e.to_string())?)
        .stderr(log);

    detach(&mut command);

    command.spawn().map_err(|e| e.to_string())
}

pub fn up(paths: &Paths) -> Result<(), String> {
    let mut child = if paths.running()? {
        None
    } else {
        Some(spawn_server(paths)?)
    };
    let started = Instant::now();

    while started.elapsed() < START_TIMEOUT {
        if paths.running()?
            && let Some(code) = paths.read_code()
        {
            println!("{code}");

            return Ok(());
        }

        let exited = child
            .as_mut()
            .and_then(|child| child.try_wait().ok().flatten());

        if let Some(status) = exited
            && !paths.running()?
        {
            let log = std::fs::read_to_string(paths.log()).unwrap_or_default();

            return Err(format!("sync server exited ({status})\n{}", log.trim()));
        }

        std::thread::sleep(POLL);
    }

    Err(format!(
        "sync server did not come online in {}s; see {}",
        START_TIMEOUT.as_secs(),
        paths.log().display()
    ))
}

pub fn code(paths: &Paths) -> Result<(), String> {
    let code = paths
        .read_code()
        .filter(|_| paths.running().unwrap_or(false))
        .ok_or("the sync server is not running; start it with `eris sync up`")?;

    println!("{code}");

    Ok(())
}

pub fn down(paths: &Paths) -> Result<(), String> {
    if !paths.running()? {
        println!("not running");

        return Ok(());
    }

    let pid = std::fs::read_to_string(paths.pid()).map_err(|e| e.to_string())?;
    let pid = pid.trim();

    let status = if cfg!(windows) {
        Command::new("taskkill").args(["/PID", pid, "/F"]).status()
    } else {
        Command::new("kill").arg(pid).status()
    }
    .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err(format!("could not stop process {pid}"));
    }

    let stopping = Instant::now();

    while paths.running()? {
        if stopping.elapsed() > STOP_TIMEOUT {
            return Err(format!("process {pid} did not stop"));
        }

        std::thread::sleep(POLL);
    }

    let _ = std::fs::remove_file(paths.code());
    let _ = std::fs::remove_file(paths.pid());
    println!("stopped");

    Ok(())
}

pub fn status(paths: &Paths) -> Result<(), String> {
    println!("running: {}", if paths.running()? { "yes" } else { "no" });

    let Some(status) = eris_p2p::stored_status(&paths.dir)? else {
        return Ok(());
    };
    let now = eris_cli::store::now() as u64;

    println!("node: {}", status.node_id);
    println!("paired: {}", status.paired);
    println!("devices: {}", status.peers.len());

    for peer in status.peers {
        let seen = peer.last_seen.map_or("never".to_string(), |at| {
            format!("{}s ago", now.saturating_sub(at) / 1000)
        });

        println!("  {}  {}  last seen {seen}", peer.name, peer.node_id);
    }

    Ok(())
}
