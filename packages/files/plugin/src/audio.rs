use std::collections::VecDeque;
use std::fs::File;
use std::path::Path;
use std::sync::Mutex;
use std::time::SystemTime;

use serde::Serialize;
use symphonia::core::codecs::audio::{AudioDecoder, AudioDecoderOptions};
use symphonia::core::codecs::CodecParameters;
use symphonia::core::errors::Error as DecodeError;
use symphonia::core::formats::probe::Hint;
use symphonia::core::formats::{FormatOptions, FormatReader, TrackType};
use symphonia::core::io::MediaSourceStream;
use symphonia::core::meta::{MetadataOptions, MetadataRevision, StandardTag, StandardVisualKey};
use symphonia::core::packet::Packet;

use crate::error::{Error, Result};

const BUCKETS: usize = 1_000;
const DECODES_PER_BUCKET: u8 = 8;
const CACHE_LIMIT: usize = 64;
const COVER_LIMIT: usize = 512 * 1024;

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Details {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    year: Option<String>,
    track: Option<u64>,
    genre: Option<String>,
    sample_rate: Option<u32>,
    channels: Option<usize>,
    cover: Option<String>,
}

impl Details {
    fn take(&mut self, tag: &StandardTag) {
        let fill = |slot: &mut Option<String>, value: &str| {
            let value = value.trim();

            if slot.is_none() && !value.is_empty() {
                *slot = Some(value.to_string());
            }
        };

        match tag {
            StandardTag::TrackTitle(value) => fill(&mut self.title, value),
            StandardTag::Artist(value) => fill(&mut self.artist, value),
            StandardTag::Album(value) => fill(&mut self.album, value),
            StandardTag::Genre(value) => fill(&mut self.genre, value),
            StandardTag::RecordingDate(value)
            | StandardTag::ReleaseDate(value)
            | StandardTag::OriginalReleaseDate(value) => fill(&mut self.year, value),
            StandardTag::RecordingYear(year) | StandardTag::ReleaseYear(year) => {
                fill(&mut self.year, &year.to_string())
            }
            StandardTag::TrackNumber(number) => {
                self.track.get_or_insert(*number);
            }
            _ => {}
        }
    }

    fn read(&mut self, revision: &MetadataRevision) {
        let containers = std::iter::once(&revision.media)
            .chain(revision.per_track.iter().map(|track| &track.metadata));

        for container in containers {
            for tag in container.tags.iter().filter_map(|tag| tag.std.as_ref()) {
                self.take(tag);
            }

            let cover = container
                .visuals
                .iter()
                .filter(|visual| visual.data.len() <= COVER_LIMIT)
                .max_by_key(|visual| visual.usage == Some(StandardVisualKey::FrontCover));

            if let (None, Some(visual)) = (&self.cover, cover) {
                self.cover = Some(format!(
                    "data:{};base64,{}",
                    visual.media_type.as_deref().unwrap_or("image/jpeg"),
                    data_encoding::BASE64.encode(&visual.data)
                ));
            }
        }
    }
}

#[derive(Clone, Serialize)]
pub struct Waveform {
    peaks: Option<Vec<u8>>,
    duration: Option<f64>,
    size: u64,
    details: Details,
}

type CacheKey = (String, u64, Option<SystemTime>);

static CACHE: Mutex<VecDeque<(CacheKey, Waveform)>> = Mutex::new(VecDeque::new());

pub struct Source {
    reader: Box<dyn FormatReader>,
    decoder: Box<dyn AudioDecoder>,
    track: u32,
    pub rate: u32,
    seconds_per_tick: f64,
    pub duration: Option<f64>,
    scratch: Vec<f32>,
}

impl Source {
    pub fn open(path: &Path) -> Result<Source> {
        let file = File::open(path)?;
        let stream = MediaSourceStream::new(Box::new(file), Default::default());
        let mut hint = Hint::new();

        if let Some(extension) = path.extension().and_then(|e| e.to_str()) {
            hint.with_extension(extension);
        }

        let reader = symphonia::default::get_probe()
            .probe(
                &hint,
                stream,
                FormatOptions::default(),
                MetadataOptions::default(),
            )
            .map_err(|_| Error::Unsupported)?;

        let track = reader
            .default_track(TrackType::Audio)
            .ok_or(Error::Unsupported)?;

        let Some(CodecParameters::Audio(params)) = &track.codec_params else {
            return Err(Error::Unsupported);
        };

        let rate = params.sample_rate.ok_or(Error::Unsupported)?;
        let seconds_per_tick = track
            .time_base
            .map(|base| f64::from(base.numer.get()) / f64::from(base.denom.get()))
            .unwrap_or(1.0 / f64::from(rate));
        let duration = track
            .duration
            .map(|ticks| ticks.get() as f64 * seconds_per_tick)
            .or(track
                .num_frames
                .map(|frames| frames as f64 / f64::from(rate)));

        let decoder = symphonia::default::get_codecs()
            .make_audio_decoder(params, &AudioDecoderOptions::default())
            .map_err(|_| Error::Unsupported)?;

        Ok(Source {
            track: track.id,
            reader,
            decoder,
            rate,
            seconds_per_tick,
            duration,
            scratch: Vec::new(),
        })
    }

    pub fn next(&mut self) -> Option<Packet> {
        loop {
            match self.reader.next_packet() {
                Ok(Some(packet)) if packet.track_id == self.track => return Some(packet),
                Ok(Some(_)) => continue,
                Err(DecodeError::ResetRequired) => self.decoder.reset(),
                _ => return None,
            }
        }
    }

    fn start(&self, packet: &Packet) -> f64 {
        packet.pts.get() as f64 * self.seconds_per_tick
    }

    pub fn decode(&mut self, packet: &Packet) -> Option<(&[f32], usize)> {
        let buffer = self.decoder.decode(packet).ok()?;
        let channels = buffer.num_planes().max(1);

        self.scratch.clear();
        buffer.copy_to_vec_interleaved::<f32>(&mut self.scratch);

        Some((&self.scratch, channels))
    }
}

fn describe(path: &Path) -> Details {
    let Ok(mut source) = Source::open(path) else {
        return Details::default();
    };

    let mut details = Details {
        sample_rate: Some(source.rate),
        channels: source
            .decoder
            .codec_params()
            .channels
            .as_ref()
            .map(|channels| channels.count()),
        ..Details::default()
    };
    let mut metadata = source.reader.metadata();

    loop {
        if let Some(revision) = metadata.current() {
            details.read(revision);
        }

        if metadata.pop().is_none() {
            break;
        }
    }

    details
}

fn bucket(at: f64, duration: f64) -> usize {
    ((at / duration * BUCKETS as f64) as usize).min(BUCKETS - 1)
}

fn measure(path: &Path) -> Option<(Vec<u8>, f64)> {
    let mut source = Source::open(path).ok()?;
    let known = source.duration.filter(|d| *d > 0.0);
    let mut decoded = vec![0u8; BUCKETS];
    let mut found: Vec<(f64, f32)> = Vec::new();
    let mut end: f64 = 0.0;

    while let Some(packet) = source.next() {
        let at = source.start(&packet);

        end = end.max(at + packet.dur.get() as f64 * source.seconds_per_tick);

        let slot = known.map(|duration| bucket(at, duration));

        if slot.is_some_and(|index| decoded[index] >= DECODES_PER_BUCKET) {
            continue;
        }

        let Some((samples, _)) = source.decode(&packet) else {
            continue;
        };

        let peak = samples.iter().fold(0f32, |top, s| top.max(s.abs()));

        found.push((at, peak));

        if let Some(index) = slot {
            decoded[index] += 1;
        }
    }

    let duration = known.unwrap_or(end);

    if duration <= 0.0 {
        return None;
    }

    let mut peaks = vec![0f32; BUCKETS];

    for (at, peak) in found {
        let index = bucket(at, duration);

        peaks[index] = peaks[index].max(peak);
    }

    let loudest = peaks
        .iter()
        .fold(0f32, |top, p| top.max(*p))
        .max(f32::EPSILON);

    let scaled = peaks
        .iter()
        .map(|p| ((p / loudest).min(1.0) * 255.0).round() as u8)
        .collect();

    Some((scaled, duration))
}

fn waveform(path: String) -> Result<Waveform> {
    let meta = std::fs::metadata(&path)?;
    let key = (path.clone(), meta.len(), meta.modified().ok());
    let cached = CACHE
        .lock()
        .unwrap()
        .iter()
        .find(|(stored, _)| *stored == key)
        .map(|(_, hit)| hit.clone());

    if let Some(hit) = cached {
        return Ok(hit);
    }

    let measured = measure(Path::new(&path));
    let waveform = Waveform {
        duration: measured.as_ref().map(|(_, duration)| *duration),
        peaks: measured.map(|(peaks, _)| peaks),
        size: meta.len(),
        details: describe(Path::new(&path)),
    };

    let mut cache = CACHE.lock().unwrap();

    if cache.len() >= CACHE_LIMIT {
        cache.pop_front();
    }

    cache.push_back((key, waveform.clone()));

    Ok(waveform)
}

#[tauri::command]
pub async fn audio_waveform(path: String) -> Result<Waveform> {
    tauri::async_runtime::spawn_blocking(move || waveform(path)).await?
}

#[cfg(windows)]
pub fn duration(path: &Path) -> Option<f64> {
    Source::open(path).ok()?.duration
}
