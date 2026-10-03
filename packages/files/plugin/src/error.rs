use serde::{Serialize, Serializer};
use windows::Win32::Foundation::{
    ERROR_ACCESS_DENIED, ERROR_CANCELLED, ERROR_DIRECTORY, ERROR_FILE_NOT_FOUND,
    ERROR_INVALID_NAME, ERROR_NOT_READY, ERROR_PATH_NOT_FOUND, WIN32_ERROR,
};

const USER_CANCELLED: windows::core::HRESULT = windows::core::HRESULT(0x8027_0000_u32 as i32);

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

impl From<WIN32_ERROR> for Error {
    fn from(error: WIN32_ERROR) -> Self {
        windows::core::Error::from(error.to_hresult()).into()
    }
}

impl From<std::io::Error> for Error {
    fn from(error: std::io::Error) -> Self {
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
