use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

const TTL: Duration = Duration::from_secs(300);
const EXPLORER_APP_ID: &str = "Microsoft.Windows.Explorer";

#[derive(Clone, Serialize)]
pub struct AppEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub kind: &'static str,
    pub subtitle: String,
}

static CACHE: Mutex<Option<(Instant, Vec<AppEntry>)>> = Mutex::new(None);
static REFRESHING: AtomicBool = AtomicBool::new(false);

pub fn stable_id(path: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;

    for byte in path.to_lowercase().bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(0x0100_0000_01b3);
    }

    format!("{hash:016x}")
}

fn entry(name: String, path: String, kind: &'static str, subtitle: String) -> AppEntry {
    AppEntry {
        id: stable_id(&path),
        name,
        path,
        kind,
        subtitle,
    }
}

fn shortcut_entry(path: &Path) -> Option<AppEntry> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();

    let kind = match extension.as_str() {
        "lnk" | "url" => "shortcut",
        "exe" => "exe",
        _ => return None,
    };

    let name = path.file_stem()?.to_str()?.to_string();
    let text = path.to_string_lossy().into_owned();

    let subtitle = if kind == "exe" {
        path.file_name()?.to_str()?.to_string()
    } else {
        let folder = path
            .parent()
            .and_then(Path::file_name)
            .and_then(|folder| folder.to_str())
            .unwrap_or_default()
            .to_string();

        shortcut_target(&text)
            .and_then(|target| Some(Path::new(&target).file_name()?.to_str()?.to_string()))
            .or_else(|| explorer_link(&text).then_some("explorer.exe".into()))
            .unwrap_or(folder)
    };

    Some(entry(name, text, kind, subtitle))
}

// the File Explorer pin targets a shell folder instead of explorer.exe, so only its app id names the program
fn explorer_link(path: &str) -> bool {
    win::shortcut_app_id(path).is_some_and(|id| id == EXPLORER_APP_ID)
}

fn opens_explorer(path: &str) -> bool {
    let is_explorer = |file: &str| {
        Path::new(file)
            .file_name()
            .is_some_and(|name| name.eq_ignore_ascii_case("explorer.exe"))
    };

    is_explorer(path)
        || explorer_link(path)
        || shortcut_target(path).is_some_and(|target| is_explorer(&target))
}

fn shortcuts_in(root: PathBuf, depth: usize) -> Vec<AppEntry> {
    walkdir::WalkDir::new(root)
        .max_depth(depth)
        .into_iter()
        .filter_map(Result::ok)
        .filter_map(|found| shortcut_entry(found.path()))
        .collect()
}

fn roots() -> Vec<(PathBuf, usize)> {
    let start_menus = ["ProgramData", "APPDATA"].iter().filter_map(|var| {
        let base = PathBuf::from(std::env::var_os(var)?);

        Some((
            base.join(r"Microsoft\Windows\Start Menu\Programs"),
            usize::MAX,
        ))
    });

    let desktops = ["USERPROFILE", "PUBLIC", "OneDrive"]
        .iter()
        .filter_map(|var| Some((PathBuf::from(std::env::var_os(var)?).join("Desktop"), 1)));

    start_menus
        .chain(desktops)
        .filter(|(root, _)| root.is_dir())
        .collect()
}

fn scan() -> Vec<AppEntry> {
    let mut seen = HashSet::new();

    let mut entries: Vec<AppEntry> = roots()
        .into_iter()
        .flat_map(|(root, depth)| shortcuts_in(root, depth))
        .chain(win::store_apps())
        .filter(|found| seen.insert(found.name.to_lowercase()))
        .collect();

    entries.sort_by_key(|found| found.name.to_lowercase());

    entries
}

fn refresh_in_background() {
    if REFRESHING.swap(true, Ordering::Relaxed) {
        return;
    }

    std::thread::spawn(|| {
        let apps = scan();

        *CACHE.lock().unwrap() = Some((Instant::now(), apps));
        REFRESHING.store(false, Ordering::Relaxed);
    });
}

pub fn watch(app: AppHandle) {
    std::thread::spawn(move || {
        win::watch_folders(&roots(), || {
            *CACHE.lock().unwrap() = Some((Instant::now(), scan()));
            let _ = app.emit("apps-changed", ());
        });
    });
}

#[tauri::command(async)]
pub fn list_apps() -> Vec<AppEntry> {
    let cached = CACHE.lock().unwrap().clone();

    match cached {
        Some((at, apps)) if at.elapsed() < TTL => apps,
        Some((_, apps)) => {
            refresh_in_background();

            apps
        }
        None => {
            let apps = scan();

            *CACHE.lock().unwrap() = Some((Instant::now(), apps.clone()));

            apps
        }
    }
}

#[tauri::command(async)]
pub fn pinned_apps() -> Vec<AppEntry> {
    let Some(root) = crate::pins::folder() else {
        return Vec::new();
    };

    let mut entries = shortcuts_in(root, 1);
    let names: Vec<String> = entries.iter().map(|found| file_name(&found.path)).collect();
    let order = crate::pins::read_favorites()
        .map(|favorites| crate::pins::taskbar_order(&favorites, &names))
        .unwrap_or_default();

    entries.sort_by_key(|found| {
        let name = file_name(&found.path);

        (
            order
                .iter()
                .position(|pinned| *pinned == name)
                .unwrap_or(usize::MAX),
            found.name.to_lowercase(),
        )
    });

    entries
}

fn file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}

#[tauri::command(async)]
pub fn launch_app(app: AppHandle, path: String, admin: bool) -> Result<(), String> {
    if !admin && opens_explorer(&path) && crate::eris_files::open_instead(&app, None) {
        return Ok(());
    }

    let verb = if admin { "runas" } else { "open" };

    shell_execute(verb, &path, None, true)
}

#[tauri::command(async)]
pub fn open_location(app: AppHandle, path: String) -> Result<(), String> {
    let target = shortcut_target(&path).unwrap_or(path);

    if crate::eris_files::open_instead(&app, Some(target.clone())) {
        return Ok(());
    }

    shell_execute(
        "open",
        "explorer.exe",
        Some(&format!("/select,\"{target}\"")),
        true,
    )
}

pub fn shortcut_target(path: &str) -> Option<String> {
    win::shortcut_target(path)
}

pub fn shell_execute(
    verb: &str,
    file: &str,
    parameters: Option<&str>,
    visible: bool,
) -> Result<(), String> {
    win::shell_execute(verb, file, parameters, visible)
}

mod win {
    use std::path::PathBuf;

    use windows::core::{w, Interface, HSTRING, PCWSTR};
    use windows::Win32::Foundation::{HANDLE, WAIT_EVENT, WAIT_OBJECT_0};
    use windows::Win32::Storage::EnhancedStorage::PKEY_AppUserModel_ID;
    use windows::Win32::Storage::FileSystem::{
        FindCloseChangeNotification, FindFirstChangeNotificationW, FindNextChangeNotification,
        FILE_NOTIFY_CHANGE_DIR_NAME, FILE_NOTIFY_CHANGE_FILE_NAME,
    };
    use windows::Win32::System::Com::StructuredStorage::{
        PropVariantClear, PropVariantToStringAlloc,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED, STGM_READ,
    };
    use windows::Win32::System::Threading::{WaitForMultipleObjects, INFINITE};
    use windows::Win32::UI::Shell::PropertiesSystem::IPropertyStore;
    use windows::Win32::UI::Shell::{
        BHID_EnumItems, IEnumShellItems, IShellItem, IShellLinkW, SHCreateItemFromParsingName,
        ShellExecuteW, ShellLink, SIGDN, SIGDN_NORMALDISPLAY, SIGDN_PARENTRELATIVEPARSING,
    };
    use windows::Win32::UI::WindowsAndMessaging::{SW_HIDE, SW_SHOWNORMAL};

    use super::{entry, AppEntry};

    pub fn shell_execute(
        verb: &str,
        file: &str,
        parameters: Option<&str>,
        visible: bool,
    ) -> Result<(), String> {
        let show = if visible { SW_SHOWNORMAL } else { SW_HIDE };
        let parameters = parameters.map(HSTRING::from);

        let result = unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            ShellExecuteW(
                None,
                &HSTRING::from(verb),
                &HSTRING::from(file),
                parameters
                    .as_ref()
                    .map_or(PCWSTR::null(), |text| PCWSTR(text.as_ptr())),
                None,
                show,
            )
        };

        if result.0 as isize > 32 {
            Ok(())
        } else {
            Err(format!(
                "ShellExecuteW failed with code {}",
                result.0 as isize
            ))
        }
    }

    fn load_link(path: &str) -> Option<IShellLinkW> {
        if !path.to_lowercase().ends_with(".lnk") {
            return None;
        }

        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let link: IShellLinkW =
                CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
            let file: IPersistFile = link.cast().ok()?;

            file.Load(&HSTRING::from(path), STGM_READ).ok()?;

            Some(link)
        }
    }

    pub fn shortcut_app_id(path: &str) -> Option<String> {
        let store: IPropertyStore = load_link(path)?.cast().ok()?;

        unsafe {
            let mut value = store.GetValue(&PKEY_AppUserModel_ID).ok()?;
            let text = PropVariantToStringAlloc(&value).ok();
            let _ = PropVariantClear(&mut value);
            let id = text?.to_string().ok();

            CoTaskMemFree(Some(text?.0 as *const _));

            id
        }
    }

    pub fn shortcut_target(path: &str) -> Option<String> {
        let link = load_link(path)?;

        unsafe {
            let mut buffer = vec![0u16; 32_768];

            link.GetPath(&mut buffer, std::ptr::null_mut(), 0).ok()?;

            let end = buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len());
            let target = String::from_utf16_lossy(&buffer[..end]);

            (!target.is_empty() && std::path::Path::new(&target).exists()).then_some(target)
        }
    }

    unsafe fn display_name(item: &IShellItem, kind: SIGDN) -> Option<String> {
        let raw = unsafe { item.GetDisplayName(kind) }.ok()?;
        let text = unsafe { raw.to_string() }.ok();

        unsafe { CoTaskMemFree(Some(raw.0 as _)) };

        text
    }

    pub fn store_apps() -> Vec<AppEntry> {
        let mut entries = Vec::new();

        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let Ok(folder) =
                SHCreateItemFromParsingName::<_, _, IShellItem>(w!("shell:AppsFolder"), None)
            else {
                return entries;
            };

            let Ok(items) = folder.BindToHandler::<_, IEnumShellItems>(None, &BHID_EnumItems)
            else {
                return entries;
            };

            let mut batch: [Option<IShellItem>; 32] = std::array::from_fn(|_| None);

            loop {
                let mut fetched = 0u32;
                let _ = items.Next(&mut batch, Some(&mut fetched));

                if fetched == 0 {
                    break;
                }

                for item in batch
                    .iter_mut()
                    .take(fetched as usize)
                    .filter_map(Option::take)
                {
                    let name = display_name(&item, SIGDN_NORMALDISPLAY);
                    let parsing = display_name(&item, SIGDN_PARENTRELATIVEPARSING);

                    let (Some(name), Some(parsing)) = (name, parsing) else {
                        continue;
                    };

                    if !parsing.contains('!') {
                        continue;
                    }

                    entries.push(entry(
                        name,
                        format!("shell:AppsFolder\\{parsing}"),
                        "store",
                        "Store app".into(),
                    ));
                }
            }
        }

        entries
    }

    // installers write shortcuts in bursts, so rescan once the folders stay quiet
    const SETTLE_MS: u32 = 1_500;

    pub fn watch_folders(roots: &[(PathBuf, usize)], mut changed: impl FnMut()) {
        let filter = FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_DIR_NAME;
        let handles: Vec<HANDLE> = roots
            .iter()
            .filter_map(|(root, depth)| unsafe {
                FindFirstChangeNotificationW(&HSTRING::from(root.as_os_str()), *depth > 1, filter)
                    .ok()
            })
            .collect();

        if handles.is_empty() {
            return;
        }

        let wait = |timeout: u32| {
            signaled(
                unsafe { WaitForMultipleObjects(&handles, false, timeout) },
                handles.len(),
            )
        };

        'watch: while let Some(first) = wait(INFINITE) {
            let mut pending = Some(first);

            while let Some(index) = pending {
                if unsafe { FindNextChangeNotification(handles[index]) }.is_err() {
                    break 'watch;
                }

                pending = wait(SETTLE_MS);
            }

            changed();
        }

        for handle in handles {
            let _ = unsafe { FindCloseChangeNotification(handle) };
        }
    }

    fn signaled(result: WAIT_EVENT, count: usize) -> Option<usize> {
        let index = result.0.wrapping_sub(WAIT_OBJECT_0.0) as usize;

        (index < count).then_some(index)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_start_menu_and_store_apps() {
        let apps = list_apps();

        assert!(!apps.is_empty(), "no apps found");
        assert!(apps.iter().any(|app| app.kind == "shortcut"));
        assert!(apps.iter().any(|app| app.kind == "store"));
        assert!(apps
            .iter()
            .all(|app| !app.id.is_empty() && !app.name.is_empty()));
    }

    #[test]
    fn resolves_a_shortcut_target() {
        let apps = list_apps();

        let target = apps
            .iter()
            .filter(|app| app.path.to_lowercase().ends_with(".lnk"))
            .find_map(|app| shortcut_target(&app.path));

        assert!(target.is_some_and(|path| Path::new(&path).exists()));
    }

    #[test]
    fn expands_environment_variables_in_shortcut_targets() {
        let link = PathBuf::from(std::env::var_os("APPDATA").unwrap())
            .join(r"Microsoft\Windows\Start Menu\Programs\System Tools\Command Prompt.lnk");
        let target = shortcut_target(&link.to_string_lossy()).unwrap();

        assert!(!target.contains('%'), "unexpanded target {target}");
        assert!(target.to_lowercase().ends_with("cmd.exe"), "{target}");
    }

    #[test]
    fn ids_are_stable_and_case_insensitive() {
        assert_eq!(stable_id(r"C:\Apps\A.lnk"), stable_id(r"c:\apps\a.lnk"));
        assert_ne!(stable_id("a"), stable_id("b"));
    }
}
