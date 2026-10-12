//! Peer-to-peer snapshot exchange, with process-wide Tauri integration.

#[cfg(feature = "tauri")]
mod host;
mod node;
mod protocol;
mod state;

#[cfg(feature = "tauri")]
pub use host::*;
pub use node::{stored_status, Event, Node};
pub use protocol::{Peer, Status};
pub use state::write_private;
