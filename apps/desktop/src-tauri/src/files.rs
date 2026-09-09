use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub directory: bool,
    pub size: u64,
    pub modified: u64,
    pub hidden: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Place {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub free: u64,
    pub total: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Listing {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<Entry>,
}

#[tauri::command(async)]
pub fn list_dir(path: String) -> Result<Listing, String> {
    win::list(&path)
}

#[tauri::command(async)]
pub fn file_places() -> Vec<Place> {
    win::places()
}

#[tauri::command(async)]
pub fn search_dir(root: String, query: String) -> Vec<Entry> {
    win::search(&root, &query)
}

#[tauri::command(async)]
pub fn create_folder(path: String, name: String) -> Result<String, String> {
    win::create_folder(&path, &name)
}

#[tauri::command(async)]
pub fn rename_entry(path: String, name: String) -> Result<String, String> {
    win::rename(&path, &name)
}

#[tauri::command(async)]
pub fn delete_entries(paths: Vec<String>, permanent: bool) -> Result<(), String> {
    win::delete(&paths, permanent)
}

#[tauri::command(async)]
pub fn transfer_entries(paths: Vec<String>, target: String, cut: bool) -> Result<(), String> {
    win::transfer(&paths, &target, cut)
}

#[cfg(target_os = "windows")]
mod win {
    use std::path::{Path, PathBuf};
    use std::time::UNIX_EPOCH;

    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::Foundation::MAX_PATH;
    use windows::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDrives, GetVolumeInformationW,
        FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_SYSTEM,
    };
    use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED};
    use windows::Win32::System::Diagnostics::Debug::{
        SetThreadErrorMode, SEM_FAILCRITICALERRORS, THREAD_ERROR_MODE,
    };
    use windows::Win32::UI::Shell::{
        SHFileOperationW, FILEOPERATION_FLAGS, FOF_ALLOWUNDO, FOF_NOCONFIRMMKDIR, FO_COPY,
        FO_DELETE, FO_MOVE, SHFILEOPSTRUCTW,
    };

    use super::{Entry, Listing, Place};

    const SEARCH_LIMIT: usize = 300;

    const KNOWN: [(&str, &str); 6] = [
        ("Desktop", "Desktop"),
        ("Downloads", "Downloads"),
        ("Documents", "Documents"),
        ("Pictures", "Pictures"),
        ("Music", "Music"),
        ("Videos", "Videos"),
    ];

    fn text(path: &Path) -> String {
        path.to_string_lossy().replace('/', "\\")
    }

    fn stamp(time: std::io::Result<std::time::SystemTime>) -> u64 {
        time.ok()
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|since| since.as_millis() as u64)
            .unwrap_or_default()
    }

    fn describe(entry: &std::fs::DirEntry) -> Option<Entry> {
        use std::os::windows::fs::MetadataExt;

        let data = entry.metadata().ok()?;
        let attributes = data.file_attributes();
        let path = entry.path();

        Some(Entry {
            name: entry.file_name().to_string_lossy().to_string(),
            path: text(&path),
            directory: data.is_dir(),
            size: if data.is_dir() { 0 } else { data.len() },
            modified: stamp(data.modified()),
            hidden: attributes & (FILE_ATTRIBUTE_HIDDEN.0 | FILE_ATTRIBUTE_SYSTEM.0) != 0,
        })
    }

    pub fn list(path: &str) -> Result<Listing, String> {
        let root = PathBuf::from(path);
        let reader = std::fs::read_dir(&root).map_err(|e| e.to_string())?;

        let entries: Vec<Entry> = reader
            .flatten()
            .filter_map(|entry| describe(&entry))
            .collect();

        Ok(Listing {
            path: text(&root),
            parent: root.parent().map(text),
            entries,
        })
    }

    fn volume(letter: char) -> Option<Place> {
        let root = format!("{letter}:\\");
        let wide = HSTRING::from(root.as_str());
        let mut label = [0u16; MAX_PATH as usize];

        let named = unsafe {
            GetVolumeInformationW(
                PCWSTR(wide.as_ptr()),
                Some(&mut label),
                None,
                None,
                None,
                None,
            )
        }
        .is_ok();

        let mut free = 0u64;
        let mut total = 0u64;

        let sized = unsafe {
            GetDiskFreeSpaceExW(
                PCWSTR(wide.as_ptr()),
                None,
                Some(&mut total),
                Some(&mut free),
            )
        }
        .is_ok();

        if !sized {
            return None;
        }

        let end = label.iter().position(|c| *c == 0).unwrap_or(0);
        let name = if named && end > 0 {
            format!("{} ({letter}:)", String::from_utf16_lossy(&label[..end]))
        } else {
            format!("{letter}:")
        };

        Some(Place {
            name,
            path: root,
            kind: "drive".into(),
            free,
            total,
        })
    }

    pub fn places() -> Vec<Place> {
        let home = std::env::var("USERPROFILE").unwrap_or_default();
        let mut places: Vec<Place> = KNOWN
            .iter()
            .map(|(name, folder)| Place {
                name: (*name).into(),
                path: format!("{home}\\{folder}"),
                kind: "folder".into(),
                free: 0,
                total: 0,
            })
            .filter(|place| Path::new(&place.path).is_dir())
            .collect();

        let mask = unsafe { GetLogicalDrives() };

        // an empty card reader or a dead mapping would otherwise raise the shell's "no disk" dialog
        let previous = unsafe { SetThreadErrorMode(SEM_FAILCRITICALERRORS, None) };

        for index in 0..26u32 {
            if mask & (1 << index) == 0 {
                continue;
            }

            let letter = char::from(b'A' + index as u8);
            let root = HSTRING::from(format!("{letter}:\\").as_str());
            // 0 is unknown and 1 has no root directory; both mean there is nothing to show
            if unsafe { GetDriveTypeW(PCWSTR(root.as_ptr())) } < 2 {
                continue;
            }

            if let Some(drive) = volume(letter) {
                places.push(drive);
            }
        }

        if previous.is_ok() {
            let _ = unsafe { SetThreadErrorMode(THREAD_ERROR_MODE(0), None) };
        }

        places
    }

    pub fn search(root: &str, query: &str) -> Vec<Entry> {
        let needle = query.to_lowercase();

        if needle.is_empty() {
            return Vec::new();
        }

        walkdir::WalkDir::new(root)
            .max_depth(8)
            .into_iter()
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_string_lossy()
                    .to_lowercase()
                    .contains(&needle)
            })
            .take(SEARCH_LIMIT)
            .filter_map(|entry| {
                let data = entry.metadata().ok()?;

                Some(Entry {
                    name: entry.file_name().to_string_lossy().to_string(),
                    path: text(entry.path()),
                    directory: data.is_dir(),
                    size: if data.is_dir() { 0 } else { data.len() },
                    modified: stamp(data.modified()),
                    hidden: false,
                })
            })
            .collect()
    }

    pub fn create_folder(path: &str, name: &str) -> Result<String, String> {
        if !plain_name(name) {
            return Err("that name is not allowed".into());
        }

        let mut target = PathBuf::from(path).join(name);
        let mut attempt = 2;

        while target.exists() {
            target = PathBuf::from(path).join(format!("{name} ({attempt})"));
            attempt += 1;
        }

        std::fs::create_dir(&target).map_err(|e| e.to_string())?;

        Ok(text(&target))
    }

    fn plain_name(name: &str) -> bool {
        !name.is_empty()
            && name != "."
            && name != ".."
            && !name.contains(['\\', '/', ':', '*', '?', '"', '<', '>', '|'])
    }

    pub fn rename(path: &str, name: &str) -> Result<String, String> {
        if !plain_name(name) {
            return Err("that name is not allowed".into());
        }

        let source = PathBuf::from(path);
        let parent = source.parent().ok_or("no parent folder")?;
        let target = parent.join(name);

        if target.exists() {
            return Err("that name is taken".into());
        }

        std::fs::rename(&source, &target).map_err(|e| e.to_string())?;

        Ok(text(&target))
    }

    fn wide_list(paths: &[String]) -> Vec<u16> {
        let mut buffer: Vec<u16> = Vec::new();

        for path in paths {
            buffer.extend(path.encode_utf16());
            buffer.push(0);
        }

        buffer.push(0);
        buffer
    }

    // the shell owns undo, the recycle bin, collision prompts and the progress window
    fn shell_op(
        operation: u32,
        from: &[String],
        to: Option<&str>,
        flags: FILEOPERATION_FLAGS,
    ) -> Result<(), String> {
        // the shell puts its progress and confirmation windows up, which needs an apartment
        let _ = unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) };

        let mut source = wide_list(from);
        let mut target = to.map(|path| wide_list(&[path.to_string()]));

        let mut request = SHFILEOPSTRUCTW {
            wFunc: operation,
            pFrom: PCWSTR(source.as_mut_ptr()),
            pTo: target
                .as_mut()
                .map(|buffer| PCWSTR(buffer.as_mut_ptr()))
                .unwrap_or(PCWSTR::null()),
            fFlags: flags.0 as u16,
            ..Default::default()
        };

        let status = unsafe { SHFileOperationW(&mut request) };

        if status != 0 {
            return Err(format!("the shell refused the operation ({status})"));
        }

        if request.fAnyOperationsAborted.as_bool() {
            return Err("the operation was cancelled".into());
        }

        Ok(())
    }

    pub fn delete(paths: &[String], permanent: bool) -> Result<(), String> {
        let flags = if permanent {
            FILEOPERATION_FLAGS(0)
        } else {
            FOF_ALLOWUNDO
        };

        shell_op(FO_DELETE, paths, None, flags)
    }

    pub fn transfer(paths: &[String], target: &str, cut: bool) -> Result<(), String> {
        let operation = if cut { FO_MOVE } else { FO_COPY };

        shell_op(
            operation,
            paths,
            Some(target),
            FOF_ALLOWUNDO | FOF_NOCONFIRMMKDIR,
        )
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use super::{Entry, Listing, Place};

    pub fn list(_path: &str) -> Result<Listing, String> {
        Err("windows only".into())
    }

    pub fn places() -> Vec<Place> {
        Vec::new()
    }

    pub fn search(_root: &str, _query: &str) -> Vec<Entry> {
        Vec::new()
    }

    pub fn create_folder(_path: &str, _name: &str) -> Result<String, String> {
        Err("windows only".into())
    }

    pub fn rename(_path: &str, _name: &str) -> Result<String, String> {
        Err("windows only".into())
    }

    pub fn delete(_paths: &[String], _permanent: bool) -> Result<(), String> {
        Err("windows only".into())
    }

    pub fn transfer(_paths: &[String], _target: &str, _cut: bool) -> Result<(), String> {
        Err("windows only".into())
    }
}
