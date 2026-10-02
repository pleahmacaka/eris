use iroh::EndpointId;
use iroh_blobs::Hash;

use super::super::wire::Entry;

pub(super) enum Action {
    Agree(Option<Hash>),
    Take(Entry),
    Recycle,
    Restore(Entry),
    CopyTheirs(Entry),
    ParkMine(Entry),
    Wait,
}

pub(super) fn decide(
    local: Option<&Entry>,
    theirs: Option<&Entry>,
    base: Option<&Hash>,
    mine: &EndpointId,
    peer: &EndpointId,
) -> Action {
    let ours = local.map(|entry| &entry.hash);
    let other = theirs.map(|entry| &entry.hash);

    if ours == other {
        return Action::Agree(ours.copied());
    }

    if ours == base {
        return match theirs {
            Some(entry) => Action::Take(entry.clone()),
            None => Action::Recycle,
        };
    }

    if other == base {
        return Action::Wait;
    }

    match (local, theirs) {
        (None, Some(entry)) => Action::Restore(entry.clone()),
        (Some(kept), Some(entry))
            if (kept.modified, mine.as_bytes()) > (entry.modified, peer.as_bytes()) =>
        {
            Action::CopyTheirs(entry.clone())
        }
        (Some(_), Some(entry)) => Action::ParkMine(entry.clone()),
        _ => Action::Wait,
    }
}

pub(super) fn conflict_name(path: &str, device: &EndpointId) -> String {
    let (folder, name) = path.rsplit_once('/').unwrap_or(("", path));
    let (stem, extension) = match name.rsplit_once('.') {
        Some((stem, extension)) if !stem.is_empty() => (stem, format!(".{extension}")),
        _ => (name, String::new()),
    };
    let id = device.to_string();
    let renamed = format!("{stem} (충돌 {}){extension}", &id[..8]);

    if folder.is_empty() {
        renamed
    } else {
        format!("{folder}/{renamed}")
    }
}
