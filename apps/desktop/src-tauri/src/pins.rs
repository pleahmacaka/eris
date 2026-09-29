use std::path::{Path, PathBuf};

const LAST: u8 = 0xFF;

#[derive(Debug, PartialEq)]
pub struct PinLists {
    favorites: Vec<u8>,
    resolve: Vec<u8>,
}

pub fn folder() -> Option<PathBuf> {
    let appdata = PathBuf::from(std::env::var_os("APPDATA")?);

    Some(appdata.join(r"Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"))
}

fn file_name(path: &str) -> String {
    Path::new(path)
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn size_at(blob: &[u8], at: usize) -> Option<usize> {
    let bytes: [u8; 4] = blob.get(at..at + 4)?.try_into().ok()?;

    Some(u32::from_le_bytes(bytes) as usize)
}

fn split_favorites(blob: &[u8]) -> Option<Vec<&[u8]>> {
    let mut entries = Vec::new();
    let mut at = 0;

    loop {
        match *blob.get(at)? {
            LAST => return (at + 1 == blob.len()).then_some(entries),
            0 => {}
            _ => return None,
        }

        let end = at + 5 + size_at(blob, at + 1)?;

        entries.push(blob.get(at..end)?);
        at = end;
    }
}

fn split_resolve(blob: &[u8]) -> Option<Vec<&[u8]>> {
    let mut entries = Vec::new();
    let mut at = 0;

    while at < blob.len() {
        let end = at + 4 + size_at(blob, at)?;

        entries.push(blob.get(at..end)?);
        at = end;
    }

    Some(entries)
}

fn contains(haystack: &[u8], needle: &[u8]) -> bool {
    !needle.is_empty()
        && haystack
            .windows(needle.len())
            .any(|window| window == needle)
}

fn utf16(text: &str) -> Vec<u8> {
    text.encode_utf16().flat_map(u16::to_le_bytes).collect()
}

fn pinned_name<'a>(entry: &[u8], names: &'a [String]) -> Option<&'a String> {
    names
        .iter()
        .filter(|name| contains(entry, &utf16(name)))
        .max_by_key(|name| name.len())
}

pub fn taskbar_order(favorites: &[u8], names: &[String]) -> Vec<String> {
    split_favorites(favorites)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| pinned_name(entry, names).cloned())
        .collect()
}

pub fn reordered(
    favorites: &[u8],
    resolve: &[u8],
    names: &[String],
    wanted: &[String],
) -> Result<Option<PinLists>, String> {
    let unknown = || "the taskbar pin list has an unknown layout".to_string();
    let favorite_entries = split_favorites(favorites).ok_or_else(unknown)?;
    let resolve_entries = split_resolve(resolve).ok_or_else(unknown)?;

    if favorite_entries.len() != resolve_entries.len() {
        return Err(unknown());
    }

    let ranks: Vec<Option<usize>> = favorite_entries
        .iter()
        .map(|entry| {
            let name = pinned_name(entry, names)?;

            wanted.iter().position(|w| w.eq_ignore_ascii_case(name))
        })
        .collect();

    let slots: Vec<usize> = (0..ranks.len()).filter(|at| ranks[*at].is_some()).collect();
    let mut movers = slots.clone();

    movers.sort_by_key(|at| ranks[*at]);

    let mut order: Vec<usize> = (0..favorite_entries.len()).collect();

    for (slot, mover) in slots.iter().zip(movers) {
        order[*slot] = mover;
    }

    if order.iter().enumerate().all(|(at, index)| at == *index) {
        return Ok(None);
    }

    let mut next_favorites: Vec<u8> = order
        .iter()
        .flat_map(|index| favorite_entries[*index].iter().copied())
        .collect();

    next_favorites.push(LAST);

    let next_resolve = order
        .iter()
        .flat_map(|index| resolve_entries[*index].iter().copied())
        .collect();

    Ok(Some(PinLists {
        favorites: next_favorites,
        resolve: next_resolve,
    }))
}

fn shortcut_names(paths: &[PathBuf]) -> Vec<String> {
    paths
        .iter()
        .map(|path| file_name(&path.to_string_lossy()))
        .collect()
}

#[tauri::command(async)]
pub fn reorder_pins(paths: Vec<String>) -> Result<(), String> {
    let wanted: Vec<String> = paths.iter().map(|path| file_name(path)).collect();
    let names = win::pinned_names();
    let favorites = win::read("Favorites").ok_or("the taskbar pin list is missing")?;
    let resolve = win::read("FavoritesResolve").ok_or("the taskbar pin list is missing")?;

    let Some(next) = reordered(&favorites, &resolve, &names, &wanted)? else {
        return Ok(());
    };

    win::write("FavoritesResolve", &next.resolve)?;
    win::write("Favorites", &next.favorites)
}

pub fn read_favorites() -> Option<Vec<u8>> {
    win::read("Favorites")
}

#[cfg(target_os = "windows")]
mod win {
    use windows::core::{w, HSTRING, PCWSTR};
    use windows::Win32::System::Registry::{
        RegGetValueW, RegSetKeyValueW, HKEY_CURRENT_USER, REG_BINARY, RRF_RT_REG_BINARY,
    };

    const TASKBAND: PCWSTR = w!(r"Software\Microsoft\Windows\CurrentVersion\Explorer\Taskband");

    pub fn read(name: &str) -> Option<Vec<u8>> {
        let name = HSTRING::from(name);
        let mut size = 0u32;

        unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                TASKBAND,
                &name,
                RRF_RT_REG_BINARY,
                None,
                None,
                Some(&mut size),
            )
        }
        .ok()
        .ok()?;

        let mut buffer = vec![0u8; size as usize];

        unsafe {
            RegGetValueW(
                HKEY_CURRENT_USER,
                TASKBAND,
                &name,
                RRF_RT_REG_BINARY,
                None,
                Some(buffer.as_mut_ptr().cast()),
                Some(&mut size),
            )
        }
        .ok()
        .ok()?;

        buffer.truncate(size as usize);

        Some(buffer)
    }

    pub fn write(name: &str, data: &[u8]) -> Result<(), String> {
        let name = HSTRING::from(name);

        unsafe {
            RegSetKeyValueW(
                HKEY_CURRENT_USER,
                TASKBAND,
                &name,
                REG_BINARY.0,
                Some(data.as_ptr().cast()),
                data.len() as u32,
            )
        }
        .ok()
        .map_err(|e| e.to_string())
    }

    pub fn pinned_names() -> Vec<String> {
        let Some(folder) = super::folder() else {
            return Vec::new();
        };

        let paths: Vec<_> = std::fs::read_dir(folder)
            .map(|entries| {
                entries
                    .filter_map(Result::ok)
                    .map(|entry| entry.path())
                    .collect()
            })
            .unwrap_or_default();

        super::shortcut_names(&paths)
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    pub fn read(_name: &str) -> Option<Vec<u8>> {
        None
    }

    pub fn write(_name: &str, _data: &[u8]) -> Result<(), String> {
        Err("taskbar pins exist only on Windows".into())
    }

    pub fn pinned_names() -> Vec<String> {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::{reordered, taskbar_order, utf16, PinLists};

    fn favorite(name: &str) -> Vec<u8> {
        let pidl = [vec![1, 2, 3], utf16(name), vec![0, 0]].concat();

        [vec![0], (pidl.len() as u32).to_le_bytes().to_vec(), pidl].concat()
    }

    fn resolve(tag: u8) -> Vec<u8> {
        [4u32.to_le_bytes().to_vec(), vec![tag; 4]].concat()
    }

    fn blobs(order: &[&str]) -> (Vec<u8>, Vec<u8>) {
        let mut favorites: Vec<u8> = order.iter().flat_map(|name| favorite(name)).collect();

        favorites.push(0xFF);

        let resolves = order
            .iter()
            .flat_map(|name| resolve(name.as_bytes()[0]))
            .collect();

        (favorites, resolves)
    }

    fn names(list: &[&str]) -> Vec<String> {
        list.iter().map(|name| name.to_string()).collect()
    }

    #[test]
    fn taskbar_order_follows_the_registry_not_the_folder() {
        let all = names(&["Zed.lnk", "Brave.lnk", "BlazeZed.lnk"]);
        let (favorites, _) = blobs(&["BlazeZed.lnk", "Zed.lnk", "Brave.lnk"]);

        assert_eq!(
            taskbar_order(&favorites, &all),
            names(&["BlazeZed.lnk", "Zed.lnk", "Brave.lnk"])
        );
    }

    #[test]
    fn reordering_moves_both_lists_together() {
        let all = names(&["A.lnk", "B.lnk", "C.lnk"]);
        let (favorites, resolves) = blobs(&["A.lnk", "B.lnk", "C.lnk"]);
        let (expected_favorites, expected_resolves) = blobs(&["C.lnk", "A.lnk", "B.lnk"]);

        let result = reordered(
            &favorites,
            &resolves,
            &all,
            &names(&["C.lnk", "A.lnk", "B.lnk"]),
        );

        assert_eq!(
            result,
            Ok(Some(PinLists {
                favorites: expected_favorites,
                resolve: expected_resolves,
            }))
        );
        assert_eq!(reordered(&favorites, &resolves, &all, &all), Ok(None));
    }

    #[test]
    fn pins_outside_the_dock_keep_their_place() {
        let all = names(&["A.lnk", "B.lnk", "C.lnk", "D.lnk"]);
        let (favorites, resolves) = blobs(&["A.lnk", "Store.app", "B.lnk", "C.lnk", "D.lnk"]);
        let (expected_favorites, expected_resolves) =
            blobs(&["D.lnk", "Store.app", "B.lnk", "C.lnk", "A.lnk"]);

        let result = reordered(&favorites, &resolves, &all, &names(&["D.lnk", "A.lnk"]));

        assert_eq!(
            result,
            Ok(Some(PinLists {
                favorites: expected_favorites,
                resolve: expected_resolves,
            }))
        );
    }

    #[test]
    fn an_unknown_layout_is_left_untouched() {
        let all = names(&["A.lnk"]);
        let (favorites, _) = blobs(&["A.lnk"]);

        assert!(reordered(&favorites, &[], &all, &all).is_err());
        assert!(reordered(&[7, 7], &[], &all, &all).is_err());
    }
}
