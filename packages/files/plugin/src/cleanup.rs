use std::collections::HashMap;
use std::path::Path;
use std::sync::{Mutex, Once};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Deserialize;

use crate::error::Result;

const MARKS: [&str; 3] = ["setup", "install", "설치"];

fn marked(text: &str) -> bool {
    let lower = text.to_lowercase();

    !lower.contains("uninstall") && MARKS.iter().any(|mark| lower.contains(mark))
}

#[cfg(windows)]
fn version_strings(path: &str) -> Vec<String> {
    use windows::core::HSTRING;
    use windows::Win32::Storage::FileSystem::{
        GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW,
    };

    let file = HSTRING::from(path);
    let size = unsafe { GetFileVersionInfoSizeW(&file, None) };

    if size == 0 {
        return Vec::new();
    }

    let mut data = vec![0u8; size as usize];

    if unsafe { GetFileVersionInfoW(&file, None, size, data.as_mut_ptr().cast()) }.is_err() {
        return Vec::new();
    }

    let query = |key: &HSTRING| {
        let mut value = std::ptr::null_mut();
        let mut length = 0u32;
        let found =
            unsafe { VerQueryValueW(data.as_ptr().cast(), key, &mut value, &mut length) }.as_bool();

        (found && length > 0).then_some((value as *const u16, length as usize))
    };

    let Some((pairs, bytes)) = query(&HSTRING::from("\\VarFileInfo\\Translation")) else {
        return Vec::new();
    };
    let pairs = unsafe { std::slice::from_raw_parts(pairs, bytes / 2) }.to_vec();

    pairs
        .chunks_exact(2)
        .flat_map(|pair| {
            [
                "FileDescription",
                "ProductName",
                "OriginalFilename",
                "InternalName",
            ]
            .map(|field| format!("\\StringFileInfo\\{:04x}{:04x}\\{field}", pair[0], pair[1]))
        })
        .filter_map(|key| query(&HSTRING::from(key)))
        .map(|(text, chars)| {
            let text = unsafe { std::slice::from_raw_parts(text, chars) };

            String::from_utf16_lossy(text)
                .trim_end_matches('\0')
                .to_string()
        })
        .collect()
}

#[cfg(not(windows))]
fn version_strings(_path: &str) -> Vec<String> {
    Vec::new()
}

const MSI_MAGIC: [u8; 8] = [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1];

const IMAGE_MARKERS: [&[u8]; 4] = [
    b"Nullsoft.NSIS",
    b"JR.Inno.Setup",
    b"Inno Setup",
    b"InstallShield",
];

const OVERLAY_MARKERS: [&[u8]; 2] = [b"NullsoftInst", b"Inno Setup Setup Data"];

const IMAGE_SCAN: u64 = 16 << 20;
const OVERLAY_SCAN: u64 = 1 << 20;

fn contains_any(bytes: &[u8], markers: &[&[u8]]) -> bool {
    markers
        .iter()
        .any(|marker| memchr::memmem::find(bytes, marker).is_some())
}

fn is_msi(path: &Path) -> bool {
    let mut head = [0u8; 8];

    std::fs::File::open(path)
        .and_then(|mut file| std::io::Read::read_exact(&mut file, &mut head))
        .is_ok_and(|()| head == MSI_MAGIC)
}

fn built_by_installer_engine(path: &Path) -> bool {
    use object::{Object, ObjectSection, ReadRef};

    let Ok(file) = std::fs::File::open(path) else {
        return false;
    };
    let cache = object::ReadCache::new(file);
    let Ok(pe) = object::File::parse(&cache) else {
        return false;
    };

    if pe.format() != object::BinaryFormat::Pe {
        return false;
    }

    if pe
        .sections()
        .any(|section| section.name() == Ok(".wixburn"))
    {
        return true;
    }

    let image_end = pe
        .sections()
        .filter_map(|section| section.file_range())
        .map(|(offset, size)| offset + size)
        .max()
        .unwrap_or(0);
    let file_end = cache.len().unwrap_or(0);
    let window = |start: u64, size: u64| {
        let size = size.min(file_end.saturating_sub(start));

        cache.read_bytes_at(start, size).unwrap_or_default()
    };

    contains_any(window(0, image_end.min(IMAGE_SCAN)), &IMAGE_MARKERS)
        || contains_any(window(image_end, OVERLAY_SCAN), &OVERLAY_MARKERS)
}

fn is_installer(path: &str) -> bool {
    let path = Path::new(path);
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    if name.contains("uninstall") {
        return false;
    }

    match installer_extension(path) {
        Some("msi") => is_msi(path),
        Some("exe") => {
            built_by_installer_engine(path)
                || version_strings(&path.to_string_lossy())
                    .iter()
                    .any(|text| marked(text))
        }
        _ => false,
    }
}

fn installer_extension(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?;

    ["exe", "msi"]
        .into_iter()
        .find(|known| extension.eq_ignore_ascii_case(known))
}

#[tauri::command]
pub async fn installers(paths: Vec<String>) -> Result<Vec<String>> {
    Ok(tauri::async_runtime::spawn_blocking(move || {
        paths
            .into_iter()
            .filter(|path| is_installer(path))
            .collect()
    })
    .await?)
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    folder: String,
    hours: u64,
    since: u64,
    keep: Vec<String>,
    #[serde(default)]
    deadlines: HashMap<String, u64>,
}

const HOUR: u64 = 3_600_000;
const SWEEP: Duration = Duration::from_secs(5 * 60);

static PLAN: Mutex<Option<Plan>> = Mutex::new(None);
static SWEEPER: Once = Once::new();

fn millis(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH)
        .map_or(0, |since| since.as_millis() as u64)
}

#[cfg(windows)]
fn cloud_only(meta: &std::fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;

    // offline, recall-on-open and recall-on-data-access: reading these would download them
    meta.file_attributes() & (0x1000 | 0x40000 | 0x400000) != 0
}

#[cfg(not(windows))]
fn cloud_only(_meta: &std::fs::Metadata) -> bool {
    false
}

fn due(plan: &Plan) -> Vec<String> {
    let now = millis(SystemTime::now());
    let Ok(entries) = std::fs::read_dir(&plan.folder) else {
        return Vec::new();
    };

    entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            let meta = entry.metadata().ok()?;

            if !meta.is_file() || installer_extension(&path).is_none() || cloud_only(&meta) {
                return None;
            }

            let born = millis(meta.created().or_else(|_| meta.modified()).ok()?);
            let key = format!("{}|{born}", entry.file_name().to_string_lossy());

            if plan.keep.contains(&key) {
                return None;
            }

            let deadline = plan
                .deadlines
                .get(&key)
                .copied()
                .unwrap_or_else(|| born.max(plan.since) + plan.hours * HOUR);

            (now >= deadline).then(|| path.to_string_lossy().into_owned())
        })
        .filter(|path| is_installer(path))
        .collect()
}

#[cfg(windows)]
mod bin {
    use windows::core::{implement, Ref, Result, HRESULT, PCWSTR};
    use windows::Win32::Foundation::E_ABORT;
    use windows::Win32::System::Com::{CoCreateInstance, CLSCTX_ALL};
    use windows::Win32::UI::Shell::{
        FileOperation, IFileOperation, IFileOperationProgressSink, IFileOperationProgressSink_Impl,
        IShellItem, FOFX_RECYCLEONDELETE, FOF_ALLOWUNDO, FOF_NOCONFIRMATION, FOF_NOERRORUI,
        FOF_SILENT, TSF_DELETE_RECYCLE_IF_POSSIBLE,
    };

    #[implement(IFileOperationProgressSink)]
    struct RecycleOnly;

    impl IFileOperationProgressSink_Impl for RecycleOnly_Impl {
        fn StartOperations(&self) -> Result<()> {
            Ok(())
        }

        fn FinishOperations(&self, _: HRESULT) -> Result<()> {
            Ok(())
        }

        fn PreRenameItem(&self, _: u32, _: Ref<IShellItem>, _: &PCWSTR) -> Result<()> {
            Ok(())
        }

        fn PostRenameItem(
            &self,
            _: u32,
            _: Ref<IShellItem>,
            _: &PCWSTR,
            _: HRESULT,
            _: Ref<IShellItem>,
        ) -> Result<()> {
            Ok(())
        }

        fn PreMoveItem(
            &self,
            _: u32,
            _: Ref<IShellItem>,
            _: Ref<IShellItem>,
            _: &PCWSTR,
        ) -> Result<()> {
            Ok(())
        }

        fn PostMoveItem(
            &self,
            _: u32,
            _: Ref<IShellItem>,
            _: Ref<IShellItem>,
            _: &PCWSTR,
            _: HRESULT,
            _: Ref<IShellItem>,
        ) -> Result<()> {
            Ok(())
        }

        fn PreCopyItem(
            &self,
            _: u32,
            _: Ref<IShellItem>,
            _: Ref<IShellItem>,
            _: &PCWSTR,
        ) -> Result<()> {
            Ok(())
        }

        fn PostCopyItem(
            &self,
            _: u32,
            _: Ref<IShellItem>,
            _: Ref<IShellItem>,
            _: &PCWSTR,
            _: HRESULT,
            _: Ref<IShellItem>,
        ) -> Result<()> {
            Ok(())
        }

        // the shell clears this flag when the item would be destroyed instead of recycled
        fn PreDeleteItem(&self, flags: u32, _: Ref<IShellItem>) -> Result<()> {
            if flags & TSF_DELETE_RECYCLE_IF_POSSIBLE.0 as u32 != 0 {
                Ok(())
            } else {
                Err(E_ABORT.into())
            }
        }

        fn PostDeleteItem(
            &self,
            _: u32,
            _: Ref<IShellItem>,
            _: HRESULT,
            _: Ref<IShellItem>,
        ) -> Result<()> {
            Ok(())
        }

        fn PreNewItem(&self, _: u32, _: Ref<IShellItem>, _: &PCWSTR) -> Result<()> {
            Ok(())
        }

        fn PostNewItem(
            &self,
            _: u32,
            _: Ref<IShellItem>,
            _: &PCWSTR,
            _: &PCWSTR,
            _: u32,
            _: HRESULT,
            _: Ref<IShellItem>,
        ) -> Result<()> {
            Ok(())
        }

        fn UpdateProgress(&self, _: u32, _: u32) -> Result<()> {
            Ok(())
        }

        fn ResetTimer(&self) -> Result<()> {
            Ok(())
        }

        fn PauseTimer(&self) -> Result<()> {
            Ok(())
        }

        fn ResumeTimer(&self) -> Result<()> {
            Ok(())
        }
    }

    fn recycle_one(path: &str) -> crate::error::Result<()> {
        let item = crate::com::item(path)?;
        let sink: IFileOperationProgressSink = RecycleOnly.into();
        let operation: IFileOperation =
            unsafe { CoCreateInstance(&FileOperation, None, CLSCTX_ALL) }?;

        unsafe {
            operation.SetOperationFlags(
                FOF_ALLOWUNDO
                    | FOFX_RECYCLEONDELETE
                    | FOF_NOCONFIRMATION
                    | FOF_SILENT
                    | FOF_NOERRORUI,
            )?;
            operation.DeleteItem(&item, &sink)?;
            operation.PerformOperations()?;
        }

        Ok(())
    }

    // one operation per item: a refused item aborts only its own operation
    pub fn recycle(paths: Vec<String>) {
        let _ = crate::com::blocking(move || {
            for path in paths {
                let _ = recycle_one(&path);
            }
        });
    }
}

#[cfg(not(windows))]
mod bin {
    pub fn recycle(paths: Vec<String>) {
        for path in paths {
            let _ = crate::ops::recycle(vec![path]);
        }
    }
}

#[tauri::command]
pub fn cleanup_plan(plan: Option<Plan>) {
    *PLAN.lock().unwrap() = plan;

    SWEEPER.call_once(|| {
        std::thread::spawn(|| loop {
            let plan = PLAN.lock().unwrap().clone();

            if let Some(plan) = plan {
                bin::recycle(due(&plan));
            }

            std::thread::sleep(SWEEP);
        });
    });
}
