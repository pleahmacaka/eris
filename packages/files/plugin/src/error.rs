use serde::{Serialize, Serializer};
#[cfg(windows)]
use windows::Win32::Foundation::{
    ERROR_ACCESS_DENIED, ERROR_BAD_NETPATH, ERROR_BAD_NET_NAME, ERROR_CANCELLED,
    ERROR_CONNECTION_UNAVAIL, ERROR_DIRECTORY, ERROR_FILE_NOT_FOUND, ERROR_HOST_UNREACHABLE,
    ERROR_INVALID_NAME, ERROR_NETNAME_DELETED, ERROR_NETWORK_UNREACHABLE, ERROR_NOT_CONNECTED,
    ERROR_NOT_READY, ERROR_NO_NET_OR_BAD_PATH, ERROR_PATH_NOT_FOUND, ERROR_SEM_TIMEOUT,
    ERROR_UNEXP_NET_ERR, WIN32_ERROR,
};

#[cfg(windows)]
const USER_CANCELLED: windows::core::HRESULT = windows::core::HRESULT(0x8027_0000_u32 as i32);

#[cfg(windows)]
const OFFLINE: [WIN32_ERROR; 10] = [
    ERROR_BAD_NETPATH,
    ERROR_BAD_NET_NAME,
    ERROR_NETNAME_DELETED,
    ERROR_NETWORK_UNREACHABLE,
    ERROR_HOST_UNREACHABLE,
    ERROR_SEM_TIMEOUT,
    ERROR_UNEXP_NET_ERR,
    ERROR_CONNECTION_UNAVAIL,
    ERROR_NO_NET_OR_BAD_PATH,
    ERROR_NOT_CONNECTED,
];

#[derive(Debug)]
pub enum Error {
    Missing,
    Denied,
    NotReady,
    Cancelled,
    Unsupported,
    Invalid,
    Binary,
    NoKey,
    BadKey,
    BadUrl,
    RateLimited,
    TooLarge,
    Network,
    Provider,
    Empty,
    Unreachable,
    SelfPair,
    Revoked,
    Blocked,
    Busy,
    Pending,
    Unpaired,
    Password,
    Os(String),
}

pub type Result<T> = std::result::Result<T, Error>;

impl Error {
    fn code(&self) -> &str {
        match self {
            Error::Missing => "missing",
            Error::Denied => "denied",
            Error::NotReady => "notReady",
            Error::Cancelled => "cancelled",
            Error::Unsupported => "unsupported",
            Error::Invalid => "invalid",
            Error::Binary => "binary",
            Error::NoKey => "noKey",
            Error::BadKey => "badKey",
            Error::BadUrl => "badUrl",
            Error::RateLimited => "rateLimited",
            Error::TooLarge => "tooLarge",
            Error::Network => "network",
            Error::Provider => "provider",
            Error::Empty => "empty",
            Error::Unreachable => "unreachable",
            Error::SelfPair => "self",
            Error::Revoked => "revoked",
            Error::Blocked => "blocked",
            Error::Busy => "busy",
            Error::Pending => "pending",
            Error::Unpaired => "unpaired",
            Error::Password => "password",
            Error::Os(message) => message,
        }
    }
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.code())
    }
}

impl Serialize for Error {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        serializer.serialize_str(self.code())
    }
}

#[cfg(windows)]
impl From<windows::core::Error> for Error {
    fn from(error: windows::core::Error) -> Self {
        let code = error.code();
        let is = |known: WIN32_ERROR| code == known.to_hresult();

        if code == USER_CANCELLED || is(ERROR_CANCELLED) {
            return Error::Cancelled;
        }

        if is(ERROR_ACCESS_DENIED) {
            return Error::Denied;
        }

        if is(ERROR_NOT_READY) {
            return Error::NotReady;
        }

        if OFFLINE.into_iter().any(is) {
            return Error::Unreachable;
        }

        if [
            ERROR_FILE_NOT_FOUND,
            ERROR_PATH_NOT_FOUND,
            ERROR_INVALID_NAME,
            ERROR_DIRECTORY,
        ]
        .into_iter()
        .any(is)
        {
            return Error::Missing;
        }

        Error::Os(error.message())
    }
}

#[cfg(windows)]
impl From<WIN32_ERROR> for Error {
    fn from(error: WIN32_ERROR) -> Self {
        windows::core::Error::from(error.to_hresult()).into()
    }
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
        #[cfg(windows)]
        if let Some(code) = error.raw_os_error() {
            if OFFLINE.into_iter().any(|known| known.0 == code as u32) {
                return Error::Unreachable;
            }
        }

        match error.kind() {
            std::io::ErrorKind::NotFound => Error::Missing,
            std::io::ErrorKind::PermissionDenied => Error::Denied,
            _ => Error::Os(error.to_string()),
        }
    }
}

impl From<tauri::Error> for Error {
    fn from(error: tauri::Error) -> Self {
        Error::Os(error.to_string())
    }
}

impl From<String> for Error {
    fn from(message: String) -> Self {
        Error::Os(message)
    }
}

impl From<Error> for String {
    fn from(error: Error) -> Self {
        error.code().to_string()
    }
}
