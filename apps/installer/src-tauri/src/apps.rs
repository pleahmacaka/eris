use serde::Serialize;

pub struct App {
    pub id: &'static str,
    pub name: &'static str,
    pub product: &'static str,
    pub payload: Option<&'static [u8]>,
}

include!(concat!(env!("OUT_DIR"), "/payload.rs"));

#[derive(Serialize)]
pub struct Component {
    id: &'static str,
    name: &'static str,
    installed: Option<String>,
    available: bool,
}

pub fn components() -> Vec<Component> {
    APPS.iter()
        .map(|app| Component {
            id: app.id,
            name: app.name,
            installed: crate::platform::installed(app),
            available: app.payload.is_some(),
        })
        .collect()
}

// an update run always includes eris: Eris's own updater started it, so skipping eris strands the user
pub fn preset(update: bool) -> Vec<&'static str> {
    let available = APPS.iter().filter(|app| app.payload.is_some());
    let installed: Vec<_> = available
        .clone()
        .filter(|app| crate::platform::installed(app).is_some())
        .map(|app| app.id)
        .collect();

    if update {
        APPS.iter()
            .filter(|app| app.id == "eris" || installed.contains(&app.id))
            .map(|app| app.id)
            .collect()
    } else if installed.is_empty() {
        available.map(|app| app.id).collect()
    } else {
        installed
    }
}
