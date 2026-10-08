use std::collections::HashMap;
use std::fs::File;
use std::hash::{DefaultHasher, Hash, Hasher};
use std::io::BufReader;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::path::{Component, Path, PathBuf, MAIN_SEPARATOR, MAIN_SEPARATOR_STR};
use std::process::{Command, Stdio};

use chrono::{Local, NaiveDate, NaiveDateTime, TimeZone};
use serde::{Deserialize, Serialize};
use unarc_rs::date_time::DosDateTime;
use unarc_rs::error::ArchiveError;
use unarc_rs::unified::{ArchiveFormat, ArchiveOptions, UnifiedArchive};
#[cfg(windows)]
use windows::Win32::System::Threading::CREATE_NO_WINDOW;
#[cfg(windows)]
use winreg::enums::HKEY_LOCAL_MACHINE;
#[cfg(windows)]
use winreg::RegKey;

use crate::error::{Error, Result};
use crate::listing::{extension, type_name};

#[derive(Serialize)]
pub struct ArchiveListing {
    entries: Vec<Packed>,
    types: HashMap<String, String>,
    folder: String,
}

#[derive(Serialize)]
pub struct Packed {
    path: String,
    dir: bool,
    size: u64,
    modified: u64,
}

#[derive(Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum Job {
    ExtractHere,
    ExtractAuto,
    ExtractNamed,
    CompressZip,
    Compress7z,
    CompressEach,
}

#[cfg(not(windows))]
fn bandizip() -> Option<PathBuf> {
    None
}

#[cfg(windows)]
fn bandizip() -> Option<PathBuf> {
    let folder: String = RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Bandizip")
        .ok()?
        .get_value("ProgramFolder")
        .ok()?;
    let console = Path::new(&folder).join("bz.exe");

    console.is_file().then_some(console)
}

// bz.exe is the console build, so the free edition's window and its ad popup never open
fn bz(command: &str, args: &[String]) -> Result<String> {
    let console = bandizip().ok_or(Error::Unsupported)?;

    let mut process = Command::new(console);

    process
        .arg(command)
        .arg("-consolemode:utf8")
        .args(args)
        .stdin(Stdio::null());

    #[cfg(windows)]
    process.creation_flags(CREATE_NO_WINDOW.0);

    let output = process.output()?;

    let text = String::from_utf8_lossy(&output.stdout).into_owned();

    if text.contains("Password is needed") {
        return Err(Error::Password);
    }

    let failure = text
        .lines()
        .find(|line| line.starts_with("ERROR") || line.starts_with("Error"));

    match failure {
        Some(line) if line.contains("Unknown archive") => Err(Error::Unsupported),
        Some(line) => Err(Error::Os(line.trim().to_string())),
        None if !output.status.success() => Err(Error::Os(text.trim().to_string())),
        None => Ok(text),
    }
}

fn local_millis(time: Option<NaiveDateTime>) -> u64 {
    time.and_then(|time| Local.from_local_datetime(&time).earliest())
        .map_or(0, |time| time.timestamp_millis().max(0) as u64)
}

fn spans(rule: &str) -> Vec<(usize, usize)> {
    let mut spans = Vec::new();
    let mut start = None;

    for (at, c) in rule.char_indices() {
        match (c, start) {
            ('-', None) => start = Some(at),
            (' ', Some(from)) => {
                spans.push((from, at));
                start = None;
            }
            _ => {}
        }
    }

    if let Some(from) = start {
        spans.push((from, rule.len()));
    }

    spans
}

fn row(line: &str, columns: &[(usize, usize)]) -> Option<Packed> {
    let [stamp, attr, size, _, name] = columns else {
        return None;
    };
    let field = |(from, to): (usize, usize)| line.get(from..to.min(line.len())).map(str::trim);
    let name = line.get(name.0..)?.trim_end();

    if name.is_empty() {
        return None;
    }

    Some(Packed {
        path: inner(name),
        dir: field(*attr)?.starts_with('D') || name.ends_with('\\'),
        size: field(*size)?.parse().unwrap_or(0),
        modified: local_millis(
            NaiveDateTime::parse_from_str(field(*stamp)?, "%Y-%m-%d %H:%M:%S").ok(),
        ),
    })
}

fn parse_listing(text: &str) -> Vec<Packed> {
    let mut lines = text.lines().skip_while(|line| !line.starts_with("---"));

    let Some(rule) = lines.next() else {
        return Vec::new();
    };
    let columns = spans(rule);

    lines
        .take_while(|line| !line.starts_with("---"))
        .filter_map(|line| row(line, &columns))
        .collect()
}

fn failure(error: ArchiveError) -> Error {
    match error {
        ArchiveError::PasswordRequired { .. } | ArchiveError::InvalidPassword { .. } => {
            Error::Password
        }
        ArchiveError::UnsupportedFormat(_) => Error::Unsupported,
        ArchiveError::Io(error) => error.into(),
        other => Error::Os(other.to_string()),
    }
}

fn open(path: &Path) -> Result<UnifiedArchive<BufReader<File>>> {
    let mut file = File::open(path)?;
    let format = ArchiveFormat::detect(&mut file, Some(path))?.ok_or(Error::Unsupported)?;
    let options = ArchiveOptions::new()
        .with_max_entry_size(None)
        .with_max_total_size(None);

    format
        .open_with_options(BufReader::new(file), options)
        .map_err(failure)
}

fn dos_millis(stamp: DosDateTime) -> u64 {
    local_millis(
        NaiveDate::from_ymd_opt(
            stamp.year().into(),
            stamp.month().into(),
            stamp.day().into(),
        )
        .and_then(|date| {
            date.and_hms_opt(
                stamp.hour().into(),
                stamp.minute().into(),
                stamp.second().into(),
            )
        }),
    )
}

fn inner(name: &str) -> String {
    let joined = name.replace(['/', '\\'], MAIN_SEPARATOR_STR);

    joined
        .trim_start_matches(&format!(".{MAIN_SEPARATOR}"))
        .trim_matches(MAIN_SEPARATOR)
        .to_string()
}

fn read_listing(path: &Path) -> Result<Vec<Packed>> {
    let mut archive = open(path)?;
    let mut found = Vec::new();

    for entry in archive.entries_iter() {
        let entry = entry.map_err(failure)?;

        found.push(Packed {
            path: inner(entry.name()),
            dir: entry.is_directory(),
            size: entry.original_size(),
            modified: entry.modified_time().map_or(0, dos_millis),
        });
    }

    Ok(found)
}

fn listing(path: &Path) -> Result<Vec<Packed>> {
    if bandizip().is_none() {
        return read_listing(path);
    }

    bz("l", &[path.display().to_string()]).map(|text| parse_listing(&text))
}

fn scratch_root() -> PathBuf {
    std::env::temp_dir().join("eris-archive")
}

// the folder icon comes from a real plain folder, since an archive's inner folders have no shell item
fn described(entries: Vec<Packed>) -> Result<ArchiveListing> {
    let folder = scratch_root();

    std::fs::create_dir_all(&folder)?;

    let mut types = HashMap::new();

    types.insert("/".to_string(), type_name("", true));

    for entry in entries.iter().filter(|entry| !entry.dir) {
        types
            .entry(extension(
                entry.path.rsplit(MAIN_SEPARATOR).next().unwrap_or_default(),
            ))
            .or_insert_with_key(|ext| type_name(ext, false));
    }

    Ok(ArchiveListing {
        entries,
        types,
        folder: folder.display().to_string(),
    })
}

fn scratch(archive: &Path) -> Result<PathBuf> {
    let modified = archive.metadata()?.modified()?;
    let mut hasher = DefaultHasher::new();

    archive.to_string_lossy().to_lowercase().hash(&mut hasher);
    modified.hash(&mut hasher);

    Ok(scratch_root().join(format!("{:016x}", hasher.finish())))
}

fn contained(entry: &str) -> bool {
    Path::new(entry)
        .components()
        .all(|part| matches!(part, Component::Normal(_)))
}

fn unpack(archive: &Path, entry: &str, target: &Path) -> Result<()> {
    let mut opened = open(archive)?;

    for found in opened.entries_iter() {
        let found = found.map_err(failure)?;

        if inner(found.name()) != entry {
            continue;
        }

        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let mut file = File::create(target)?;

        return opened
            .read_to(&found, &mut file)
            .map(|_| ())
            .map_err(failure);
    }

    Err(Error::Missing)
}

fn extract(archive: &Path, entry: &str) -> Result<String> {
    if !contained(entry) {
        return Err(Error::Invalid);
    }

    let root = scratch(archive)?;
    let target = root.join(entry);

    if !target.is_file() {
        match bandizip() {
            Some(_) => {
                bz(
                    "x",
                    &[
                        "-y".into(),
                        "-aoa".into(),
                        format!("-o:{}", root.display()),
                        archive.display().to_string(),
                        entry.to_string(),
                    ],
                )?;
            }
            None => unpack(archive, entry, &target)?,
        }
    }

    if target.is_file() {
        Ok(target.display().to_string())
    } else {
        Err(Error::Missing)
    }
}

fn parent(path: &Path) -> Result<&Path> {
    path.parent().ok_or(Error::Invalid)
}

fn stem(path: &Path) -> String {
    let name = if path.is_dir() {
        path.file_name()
    } else {
        path.file_stem()
    };

    name.map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default()
}

fn unique(dir: &Path, stem: &str, extension: &str) -> PathBuf {
    std::iter::once(dir.join(format!("{stem}.{extension}")))
        .chain((2..).map(|n| dir.join(format!("{stem} ({n}).{extension}"))))
        .find(|candidate| !candidate.exists())
        .unwrap_or_default()
}

fn compress(target: PathBuf, items: &[PathBuf]) -> Result<String> {
    let mut args = vec!["-y".to_string(), target.display().to_string()];

    args.extend(items.iter().map(|item| item.display().to_string()));
    bz("c", &args)?;

    Ok(target.display().to_string())
}

fn perform(job: Job, items: &[PathBuf]) -> Result<Vec<String>> {
    let [first, ..] = items else {
        return Ok(Vec::new());
    };
    let dir = parent(first)?;

    match job {
        Job::CompressZip | Job::Compress7z => {
            let extension = if job == Job::CompressZip { "zip" } else { "7z" };
            let name = match items {
                [single] => stem(single),
                _ => stem(dir),
            };

            Ok(vec![compress(unique(dir, &name, extension), items)?])
        }
        Job::CompressEach => items
            .iter()
            .map(|item| {
                compress(
                    unique(parent(item)?, &stem(item), "zip"),
                    std::slice::from_ref(item),
                )
            })
            .collect(),
        Job::ExtractHere | Job::ExtractAuto | Job::ExtractNamed => {
            for archive in items {
                let mut args = vec![
                    "-y".to_string(),
                    "-aou".to_string(),
                    format!("-o:{}", parent(archive)?.display()),
                ];

                match job {
                    Job::ExtractAuto => args.push("-target:auto".into()),
                    Job::ExtractNamed => args.push("-target:name".into()),
                    _ => {}
                }

                args.push(archive.display().to_string());
                bz("x", &args)?;
            }

            Ok(Vec::new())
        }
    }
}

#[tauri::command]
pub async fn list_archive(path: String) -> Result<ArchiveListing> {
    tauri::async_runtime::spawn_blocking(move || listing(Path::new(&path)).and_then(described))
        .await?
}

#[tauri::command]
pub async fn extract_entry(archive: String, entry: String) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || extract(Path::new(&archive), &entry)).await?
}

#[tauri::command]
pub async fn bandizip_available() -> bool {
    tauri::async_runtime::spawn_blocking(|| bandizip().is_some())
        .await
        .unwrap_or(false)
}

#[tauri::command]
pub async fn bandizip_job(job: Job, items: Vec<String>) -> Result<Vec<String>> {
    let items: Vec<PathBuf> = items.into_iter().map(PathBuf::from).collect();

    tauri::async_runtime::spawn_blocking(move || perform(job, &items)).await?
}

#[cfg(test)]
mod tests {
    use super::parse_listing;

    const LISTING: &str = "\
Listing archive: C:\\test.7z
Archive format: 7z

      Date  Time    Attr         Size     CompSize Name
------------------- ---- ------------ ------------ -------------------------
2026-10-03 22:32:18 A___            6           17 src\\a.txt
2026-10-03 22:32:18 A___            7            0 src\\sub\\한글 파일.txt
2026-10-03 22:32:18 D___            0            0 src
2026-10-03 22:32:18 D___            0            0 src\\sub\\
------------------- ---- ------------ ------------ -------------------------
2026-10-03 22:32:24                13           17 2 files, 2 folders
";

    #[test]
    fn parses_bandizip_listing_columns() {
        let entries = parse_listing(LISTING);
        let shape: Vec<(&str, bool, u64)> = entries
            .iter()
            .map(|entry| (entry.path.as_str(), entry.dir, entry.size))
            .collect();

        assert_eq!(
            shape,
            [
                ("src\\a.txt", false, 6),
                ("src\\sub\\한글 파일.txt", false, 7),
                ("src", true, 0),
                ("src\\sub", true, 0),
            ]
        );
        assert!(entries.iter().all(|entry| entry.modified > 0));
    }
}
