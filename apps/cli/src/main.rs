mod daemon;
mod server;

use std::path::{Path, PathBuf};
use std::process::ExitCode;

use clap::{Parser, Subcommand};

use daemon::Paths;

#[derive(Parser)]
#[command(
    name = "eris",
    version = option_env!("ERIS_VERSION").unwrap_or(env!("CARGO_PKG_VERSION")),
    about = "Eris command line"
)]
struct Cli {
    /// Data folder (default: $XDG_DATA_HOME/eris-sync)
    #[arg(long, global = true)]
    dir: Option<PathBuf>,

    #[command(subcommand)]
    command: Top,
}

#[derive(Subcommand)]
enum Top {
    /// Sync server
    #[command(subcommand)]
    Sync(SyncCommand),
}

#[derive(Subcommand)]
enum SyncCommand {
    /// Start the sync server in the background and print the sync code
    Up,
    /// Run the sync server in the foreground (headless mode)
    Serve,
    /// Print the sync code
    Code,
    /// Show whether the server runs and which devices joined
    Status,
    /// Stop the background sync server
    Down,
}

fn data_dir(custom: Option<PathBuf>) -> Result<PathBuf, String> {
    if let Some(dir) = custom {
        return Ok(dir);
    }

    let base = std::env::var_os("XDG_DATA_HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".local/share")))
        .or_else(|| std::env::var_os("LOCALAPPDATA").map(PathBuf::from))
        .ok_or("cannot find a data folder; pass --dir")?;

    Ok(base.join("eris-sync"))
}

fn create_private(dir: &Path) -> std::io::Result<()> {
    let mut builder = std::fs::DirBuilder::new();

    builder.recursive(true);

    #[cfg(unix)]
    std::os::unix::fs::DirBuilderExt::mode(&mut builder, 0o700);

    builder.create(dir)?;

    // the mode above only applies to a folder this call creates
    #[cfg(unix)]
    std::fs::set_permissions(dir, std::os::unix::fs::PermissionsExt::from_mode(0o700))?;

    Ok(())
}

fn run(cli: Cli) -> Result<(), String> {
    let dir = data_dir(cli.dir)?;

    create_private(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;

    let paths = Paths { dir };

    match cli.command {
        Top::Sync(SyncCommand::Up) => daemon::up(&paths),
        Top::Sync(SyncCommand::Code) => daemon::code(&paths),
        Top::Sync(SyncCommand::Status) => daemon::status(&paths),
        Top::Sync(SyncCommand::Down) => daemon::down(&paths),
        Top::Sync(SyncCommand::Serve) => tokio::runtime::Runtime::new()
            .map_err(|e| e.to_string())?
            .block_on(server::serve(&paths)),
    }
}

fn main() -> ExitCode {
    match run(Cli::parse()) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("eris: {error}");

            ExitCode::FAILURE
        }
    }
}
