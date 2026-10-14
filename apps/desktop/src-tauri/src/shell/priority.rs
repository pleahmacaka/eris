use std::os::windows::io::{FromRawHandle, OwnedHandle};
use std::sync::OnceLock;
use std::time::Duration;

use eris_window_kit::{Channel, CHANNEL};
use tauri::AppHandle;
use windows::core::HSTRING;
use windows::Win32::Foundation::ERROR_FILE_NOT_FOUND;
use windows::Win32::System::Threading::{CreateMutexW, OpenMutexW, SYNCHRONIZATION_SYNCHRONIZE};

use crate::notifications::tray;
use crate::shell::features::{self, Hold};

const CHANNELS: usize = 3;
const POLL: Duration = Duration::from_secs(1);

static RUNNING: OnceLock<OwnedHandle> = OnceLock::new();

fn rank() -> usize {
    match CHANNEL {
        Channel::Stable => 0,
        Channel::DevChannel => 1,
        Channel::Dev => 2,
    }
}

fn name(kind: &str, rank: usize) -> HSTRING {
    HSTRING::from(format!(r"Local\com.arixlab.eris.shell.{kind}.{rank}"))
}

fn hold(kind: &str, rank: usize) -> Option<OwnedHandle> {
    let handle = unsafe { CreateMutexW(None, false, &name(kind, rank)) }.ok()?;

    Some(unsafe { OwnedHandle::from_raw_handle(handle.0) })
}

fn exists(kind: &str, rank: usize) -> bool {
    match unsafe { OpenMutexW(SYNCHRONIZATION_SYNCHRONIZE, false, &name(kind, rank)) } {
        Ok(handle) => {
            drop(unsafe { OwnedHandle::from_raw_handle(handle.0) });

            true
        }
        Err(error) => error.code() != ERROR_FILE_NOT_FOUND.to_hresult(),
    }
}

fn outranked(rank: usize) -> bool {
    (rank + 1..CHANNELS).any(|higher| exists("running", higher))
}

fn claim(rank: usize) -> Option<OwnedHandle> {
    let contested = (0..CHANNELS).any(|other| other != rank && exists("owner", other));

    if contested || outranked(rank) {
        return None;
    }

    let owner = hold("owner", rank)?;

    // a higher channel can start between the first check and the hold
    if outranked(rank) {
        return None;
    }

    Some(owner)
}

pub fn start(app: &AppHandle) {
    let rank = rank();

    if let Some(running) = hold("running", rank) {
        let _ = RUNNING.set(running);
    }

    let mut owner = claim(rank);

    if owner.is_some() {
        tray::host(app.clone());
    } else {
        features::hold(app, Hold::Yielded);
    }

    let app = app.clone();

    std::thread::spawn(move || loop {
        std::thread::sleep(POLL);

        match owner {
            Some(_) if outranked(rank) => {
                features::hold(&app, Hold::Yielded);
                owner = None;
            }
            None => {
                owner = claim(rank);

                if owner.is_some() {
                    features::release(&app, Hold::Yielded);
                }
            }
            Some(_) => {}
        }
    });
}
