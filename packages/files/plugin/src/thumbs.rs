use std::collections::{HashMap, VecDeque};
use std::panic::{self, AssertUnwindSafe};
use std::sync::{Arc, Condvar, LazyLock, Mutex, Once};

use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::{ExtendedColorType, ImageEncoder};
use percent_encoding::percent_decode_str;
use tauri::http::{header, Request, Response, StatusCode};
use tauri::{UriSchemeContext, UriSchemeResponder, Wry};
use windows::core::{HSTRING, PCWSTR};
use windows::Win32::Foundation::SIZE;
use windows::Win32::Graphics::Gdi::{
    DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER,
    BI_RGB, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
};
use windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES;
use windows::Win32::UI::Shell::{
    IShellItemImageFactory, SHGetFileInfoW, SHFILEINFOW, SHGFI_PIDL, SHGFI_SYSICONINDEX, SIIGBF,
    SIIGBF_BIGGERSIZEOK, SIIGBF_ICONONLY, SIIGBF_RESIZETOFIT,
};

use crate::{com, listing};

const ICON_WORKERS: usize = 4;
const THUMB_WORKERS: usize = 2;
const CACHE_BUDGET: usize = 64 * 1024 * 1024;
const ICON_FLAGS: SIIGBF = SIIGBF(SIIGBF_ICONONLY.0 | SIIGBF_BIGGERSIZEOK.0);

type Image = Arc<Vec<u8>>;

#[derive(Clone, Copy)]
enum Kind {
    Icon,
    Item,
    Thumb,
}

struct Job {
    kind: Kind,
    size: i32,
    key: String,
    slot: String,
    version: String,
}

impl Job {
    fn waiting(&self) -> String {
        format!("{}?{}", self.slot, self.version)
    }
}

#[derive(Default)]
struct Cache {
    entries: HashMap<String, (String, Image)>,
    order: VecDeque<String>,
    bytes: usize,
}

impl Cache {
    fn get(&self, slot: &str, version: &str) -> Option<Image> {
        self.entries
            .get(slot)
            .filter(|(stored, _)| stored == version)
            .map(|(_, image)| image.clone())
    }

    fn put(&mut self, slot: String, version: String, image: Image) {
        self.bytes += image.len();

        match self.entries.insert(slot.clone(), (version, image)) {
            Some((_, replaced)) => self.bytes -= replaced.len(),
            None => self.order.push_back(slot),
        }

        while self.bytes > CACHE_BUDGET {
            let Some(oldest) = self.order.pop_front() else {
                break;
            };

            if let Some((_, evicted)) = self.entries.remove(&oldest) {
                self.bytes -= evicted.len();
            }
        }
    }
}

#[derive(Default)]
struct Lane {
    jobs: Mutex<Vec<Job>>,
    ready: Condvar,
}

impl Lane {
    fn push(&self, job: Job) {
        self.jobs.lock().unwrap().push(job);
        self.ready.notify_one();
    }

    // the newest request is what the user scrolled to, so it renders before older ones
    fn next(&self) -> Job {
        let mut jobs = self.jobs.lock().unwrap();

        loop {
            if let Some(job) = jobs.pop() {
                return job;
            }

            jobs = self.ready.wait(jobs).unwrap();
        }
    }

    fn run(&self) {
        let _apartment = com::Apartment::enter();

        loop {
            work(self.next());
        }
    }
}

#[derive(Default)]
struct Thumbs {
    cache: Mutex<Cache>,
    pending: Mutex<HashMap<String, Vec<UriSchemeResponder>>>,
    icons: Lane,
    thumbs: Lane,
}

static THUMBS: LazyLock<Thumbs> = LazyLock::new(Thumbs::default);

fn thumbs() -> &'static Thumbs {
    static WORKERS: Once = Once::new();

    WORKERS.call_once(|| {
        for _ in 0..ICON_WORKERS {
            std::thread::spawn(|| THUMBS.icons.run());
        }

        for _ in 0..THUMB_WORKERS {
            std::thread::spawn(|| THUMBS.thumbs.run());
        }
    });

    &THUMBS
}

// thumbnails decode whole images and videos, so they get their own workers instead of starving icons
fn lane(kind: Kind) -> &'static Lane {
    match kind {
        Kind::Thumb => &thumbs().thumbs,
        Kind::Icon | Kind::Item => &thumbs().icons,
    }
}

// a virtual parsing name such as "::{CLSID}" resolves to the generic folder slot, so only real paths and pidls share
fn icon_index(key: &str) -> Option<i32> {
    let bytes = key.as_bytes();
    let path = (bytes.len() > 2 && bytes[1] == b':') || key.starts_with(r"\\");

    if !path && !key.starts_with("pidl:") {
        return None;
    }

    let mut info = SHFILEINFOW::default();
    let size = std::mem::size_of::<SHFILEINFOW>() as u32;

    let found = if key.starts_with("pidl:") {
        let pidl = com::pidl(key).ok()?;

        unsafe {
            SHGetFileInfoW(
                PCWSTR(pidl.as_ptr() as *const u16),
                FILE_FLAGS_AND_ATTRIBUTES(0),
                Some(&mut info),
                size,
                SHGFI_SYSICONINDEX | SHGFI_PIDL,
            )
        }
    } else {
        unsafe {
            SHGetFileInfoW(
                &HSTRING::from(key),
                FILE_FLAGS_AND_ATTRIBUTES(0),
                Some(&mut info),
                size,
                SHGFI_SYSICONINDEX,
            )
        }
    };

    (found != 0).then_some(info.iIcon)
}

// items sharing a system image list slot share one rendering; links keep their own because of the arrow
fn item_image(key: &str, size: i32) -> Option<Image> {
    let link = matches!(listing::extension(key).as_str(), ".lnk" | ".url");
    let shared = icon_index(key).map(|index| format!("index:{size}:{index}:{link}"));

    if let Some(hit) = shared
        .as_ref()
        .and_then(|shared| thumbs().cache.lock().unwrap().get(shared, ""))
    {
        return Some(hit);
    }

    let image = Arc::new(render(key, size, ICON_FLAGS)?);

    if let Some(shared) = shared {
        thumbs()
            .cache
            .lock()
            .unwrap()
            .put(shared, String::new(), image.clone());
    }

    Some(image)
}

fn png(image: Image) -> Response<Vec<u8>> {
    Response::builder()
        .header(header::CONTENT_TYPE, "image/png")
        .header(header::CACHE_CONTROL, "max-age=86400")
        .body(image.to_vec())
        .unwrap_or_default()
}

fn missing() -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Vec::new())
        .unwrap_or_default()
}

fn draw(job: &Job) -> Option<Image> {
    match job.kind {
        Kind::Icon => render(&job.key, job.size, ICON_FLAGS).map(Arc::new),
        Kind::Item => item_image(&job.key, job.size),
        Kind::Thumb => render(&job.key, job.size, SIIGBF_RESIZETOFIT).map(Arc::new),
    }
}

// a crashing thumbnail handler must not take the worker and every queued request with it
fn work(job: Job) {
    let rendered = panic::catch_unwind(AssertUnwindSafe(|| draw(&job)))
        .ok()
        .flatten();

    if let Some(image) = &rendered {
        thumbs()
            .cache
            .lock()
            .unwrap()
            .put(job.slot.clone(), job.version.clone(), image.clone());
    }

    let waiting = thumbs()
        .pending
        .lock()
        .unwrap()
        .remove(&job.waiting())
        .unwrap_or_default();

    for responder in waiting {
        responder.respond(rendered.clone().map(png).unwrap_or_else(missing));
    }
}

pub fn serve(
    _: UriSchemeContext<'_, Wry>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let raw = request.uri().path().trim_start_matches('/');
    let decoded = percent_decode_str(raw).decode_utf8_lossy().to_string();
    let version = request.uri().query().unwrap_or_default();

    let mut parts = decoded.splitn(3, '/');
    let (Some(mode), Some(size), Some(key)) = (parts.next(), parts.next(), parts.next()) else {
        return responder.respond(missing());
    };

    let size = size.parse::<i32>().unwrap_or(32).clamp(16, 512);

    let (kind, slot, version) = match mode {
        "icon" => (
            Kind::Icon,
            format!("icon:{size}:{}", listing::extension(key)),
            "",
        ),
        "item" => (Kind::Item, format!("item:{size}:{key}"), version),
        "thumb" => (Kind::Thumb, format!("thumb:{size}:{key}"), version),
        _ => return responder.respond(missing()),
    };

    if let Some(hit) = thumbs().cache.lock().unwrap().get(&slot, version) {
        return responder.respond(png(hit));
    }

    let job = Job {
        kind,
        size,
        key: key.to_string(),
        slot,
        version: version.to_string(),
    };

    {
        let mut waiting = thumbs().pending.lock().unwrap();

        if let Some(queued) = waiting.get_mut(&job.waiting()) {
            queued.push(responder);

            return;
        }

        waiting.insert(job.waiting(), vec![responder]);
    }

    lane(kind).push(job);
}

fn render(key: &str, size: i32, flags: SIIGBF) -> Option<Vec<u8>> {
    let factory: IShellItemImageFactory = com::item(key).ok().and_then(|item| {
        use windows::core::Interface;

        item.cast().ok()
    })?;

    let bitmap = unsafe { factory.GetImage(SIZE { cx: size, cy: size }, flags) }.ok()?;
    let pixels = rgba(bitmap);

    let _ = unsafe { DeleteObject(HGDIOBJ(bitmap.0)) };

    let (width, height, pixels) = pixels?;
    let mut out = Vec::new();

    PngEncoder::new_with_quality(&mut out, CompressionType::Fast, FilterType::NoFilter)
        .write_image(&pixels, width, height, ExtendedColorType::Rgba8)
        .ok()?;

    Some(out)
}

fn rgba(bitmap: HBITMAP) -> Option<(u32, u32, Vec<u8>)> {
    let mut info = BITMAP::default();

    unsafe {
        GetObjectW(
            HGDIOBJ(bitmap.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut info as *mut _ as *mut _),
        )
    };

    let (width, height) = (info.bmWidth as u32, info.bmHeight.unsigned_abs());

    if width == 0 || height == 0 {
        return None;
    }

    let mut buffer = vec![0u8; (width * height * 4) as usize];

    let mut header = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width as i32,
            biHeight: -(height as i32),
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };

    let screen = unsafe { GetDC(None) };

    let copied = unsafe {
        GetDIBits(
            screen,
            bitmap,
            0,
            height,
            Some(buffer.as_mut_ptr() as *mut _),
            &mut header,
            DIB_RGB_COLORS,
        )
    };

    unsafe { ReleaseDC(None, screen) };

    if copied == 0 {
        return None;
    }

    let opaque = buffer.chunks_exact(4).all(|pixel| pixel[3] == 0);

    for pixel in buffer.chunks_exact_mut(4) {
        pixel.swap(0, 2);

        let alpha = pixel[3] as u32;

        if opaque {
            pixel[3] = 255;
        } else if alpha > 0 && alpha < 255 {
            for channel in &mut pixel[..3] {
                *channel = ((*channel as u32 * 255 + alpha / 2) / alpha).min(255) as u8;
            }
        }
    }

    Some((width, height, buffer))
}
