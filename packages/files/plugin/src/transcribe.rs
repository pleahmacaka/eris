use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use reqwest::multipart::{Form, Part};
use reqwest::{Client, StatusCode, Url};
use serde::{Deserialize, Serialize};
use tauri::async_runtime::spawn_blocking;
use tauri::ipc::Channel;
use tokio::sync::mpsc;

use crate::audio::{self, Source};
use crate::error::{Error, Result};

const GROQ: &str = "https://api.groq.com/openai/v1";
const OPENAI: &str = "https://api.openai.com/v1";
const UPLOAD_LIMIT: u64 = 24 * 1024 * 1024;
const UPLOADABLE: [&str; 10] = [
    "flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm",
];
const SPEECH_RATE: u32 = 16_000;
const CHUNK_SECONDS: usize = 600;
const CUT_WINDOW_SECONDS: usize = 30;
const QUIET_FRAME: usize = 320;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(600);

#[derive(Clone, Serialize, Deserialize)]
pub struct Segment {
    start: f64,
    end: f64,
    text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    speaker: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transcript {
    version: u32,
    provider: String,
    host: String,
    model: String,
    language: Option<String>,
    detected_language: Option<String>,
    created_at: u64,
    duration: f64,
    text: String,
    segments: Vec<Segment>,
}

#[derive(Serialize)]
pub struct Transcribed {
    transcript: Transcript,
    saved: bool,
}

#[derive(Clone, Serialize)]
#[serde(tag = "stage", rename_all = "camelCase")]
pub enum Progress {
    Decoding,
    Uploading { done: usize, total: usize },
}

#[derive(Serialize)]
pub struct KeyStatus {
    saved: bool,
    base: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct CustomSecret {
    base: String,
    key: String,
}

#[derive(Deserialize)]
struct Reply {
    text: String,
    #[serde(default)]
    language: Option<String>,
    #[serde(default)]
    duration: Option<f64>,
    #[serde(default)]
    segments: Option<Vec<ReplySegment>>,
}

#[derive(Deserialize)]
struct ReplySegment {
    start: f64,
    end: f64,
    text: String,
}

#[derive(Deserialize)]
struct ProviderError {
    error: ProviderMessage,
}

#[derive(Deserialize)]
struct ProviderMessage {
    message: String,
}

fn target(provider: &str) -> String {
    format!("Eris Files/transcription/{provider}")
}

fn known(provider: &str) -> Result<()> {
    match provider {
        "groq" | "openai" | "custom" => Ok(()),
        _ => Err(Error::Unsupported),
    }
}

#[cfg(windows)]
fn read_secret(provider: &str) -> Option<String> {
    use windows::core::HSTRING;
    use windows::Win32::Security::Credentials::{
        CredFree, CredReadW, CREDENTIALW, CRED_TYPE_GENERIC,
    };

    let mut found: *mut CREDENTIALW = std::ptr::null_mut();

    unsafe {
        CredReadW(
            &HSTRING::from(target(provider)),
            CRED_TYPE_GENERIC,
            None,
            &mut found,
        )
    }
    .ok()?;

    let secret = unsafe {
        let credential = &*found;
        let bytes = if credential.CredentialBlob.is_null() || credential.CredentialBlobSize == 0 {
            Vec::new()
        } else {
            std::slice::from_raw_parts(
                credential.CredentialBlob,
                credential.CredentialBlobSize as usize,
            )
            .to_vec()
        };

        CredFree(found as *const _);

        bytes
    };

    String::from_utf8(secret).ok()
}

#[cfg(windows)]
fn write_secret(provider: &str, secret: &str) -> Result<()> {
    use windows::core::{HSTRING, PWSTR};
    use windows::Win32::Security::Credentials::{
        CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
    };

    let name = HSTRING::from(target(provider));
    let mut blob = secret.as_bytes().to_vec();
    let credential = CREDENTIALW {
        Type: CRED_TYPE_GENERIC,
        TargetName: PWSTR(name.as_ptr() as *mut u16),
        CredentialBlobSize: blob.len() as u32,
        CredentialBlob: blob.as_mut_ptr(),
        Persist: CRED_PERSIST_LOCAL_MACHINE,
        ..Default::default()
    };

    Ok(unsafe { CredWriteW(&credential, 0) }?)
}

#[cfg(windows)]
fn delete_secret(provider: &str) {
    use windows::core::HSTRING;
    use windows::Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC};

    let _ = unsafe { CredDeleteW(&HSTRING::from(target(provider)), CRED_TYPE_GENERIC, None) };
}

#[cfg(not(windows))]
fn entry(provider: &str) -> Option<keyring::Entry> {
    keyring::Entry::new(&target(provider), "key").ok()
}

#[cfg(not(windows))]
fn read_secret(provider: &str) -> Option<String> {
    entry(provider)?.get_password().ok()
}

#[cfg(not(windows))]
fn write_secret(provider: &str, secret: &str) -> Result<()> {
    entry(provider)
        .ok_or(Error::Unsupported)?
        .set_password(secret)
        .map_err(|error| Error::Os(error.to_string()))
}

#[cfg(not(windows))]
fn delete_secret(provider: &str) {
    if let Some(entry) = entry(provider) {
        let _ = entry.delete_credential();
    }
}

fn custom_base(input: &str) -> Result<String> {
    let url = Url::parse(input.trim()).map_err(|_| Error::BadUrl)?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));

    if url.scheme() != "https" && !(url.scheme() == "http" && local) {
        return Err(Error::BadUrl);
    }

    Ok(url.as_str().trim_end_matches('/').to_string())
}

fn status(provider: &str) -> KeyStatus {
    let secret = read_secret(provider);
    let base = secret
        .as_deref()
        .filter(|_| provider == "custom")
        .and_then(|text| serde_json::from_str::<CustomSecret>(text).ok())
        .map(|custom| custom.base);

    KeyStatus {
        saved: secret.is_some(),
        base,
    }
}

#[tauri::command(async)]
pub fn transcribe_key_status(provider: String) -> Result<KeyStatus> {
    known(&provider)?;

    Ok(status(&provider))
}

#[tauri::command(async)]
pub fn save_transcribe_key(
    provider: String,
    key: String,
    base: Option<String>,
) -> Result<KeyStatus> {
    known(&provider)?;

    let key = key.trim();

    if key.is_empty() {
        return Err(Error::NoKey);
    }

    let secret = if provider == "custom" {
        let base = custom_base(base.as_deref().unwrap_or_default())?;

        serde_json::to_string(&CustomSecret {
            base,
            key: key.to_string(),
        })
        .map_err(|e| Error::Os(e.to_string()))?
    } else {
        key.to_string()
    };

    write_secret(&provider, &secret)?;

    Ok(status(&provider))
}

#[tauri::command(async)]
pub fn clear_transcribe_key(provider: String) -> Result<()> {
    known(&provider)?;

    delete_secret(&provider);

    Ok(())
}

fn sidecar(path: &str) -> PathBuf {
    PathBuf::from(format!("{path}.transcript.json"))
}

#[tauri::command(async)]
pub fn read_transcript(path: String) -> Option<Transcript> {
    let text = std::fs::read_to_string(sidecar(&path)).ok()?;

    serde_json::from_str(&text).ok()
}

fn save(path: &str, transcript: &Transcript) -> bool {
    let Ok(json) = serde_json::to_vec_pretty(transcript) else {
        return false;
    };

    let temporary = PathBuf::from(format!("{path}.transcript.json.tmp"));

    std::fs::write(&temporary, json).is_ok() && std::fs::rename(&temporary, sidecar(path)).is_ok()
}

fn endpoint(provider: &str) -> Result<(String, String)> {
    let secret = read_secret(provider).ok_or(Error::NoKey)?;

    match provider {
        "groq" => Ok((GROQ.into(), secret)),
        "openai" => Ok((OPENAI.into(), secret)),
        "custom" => serde_json::from_str::<CustomSecret>(&secret)
            .map(|custom| (custom.base, custom.key))
            .map_err(|_| Error::NoKey),
        _ => Err(Error::Unsupported),
    }
}

fn energy(samples: &[i16]) -> u64 {
    samples.iter().map(|s| u64::from(s.unsigned_abs())).sum()
}

fn quietest(samples: &[i16], from: usize, to: usize) -> usize {
    (from..to)
        .step_by(QUIET_FRAME)
        .min_by_key(|at| energy(&samples[*at..(*at + QUIET_FRAME).min(to)]))
        .unwrap_or(to)
}

fn speech(mut source: Source, chunks: mpsc::Sender<Vec<i16>>) -> Result<()> {
    let step = f64::from(source.rate) / f64::from(SPEECH_RATE);
    let chunk = CHUNK_SECONDS * SPEECH_RATE as usize;
    let window = CUT_WINDOW_SECONDS * SPEECH_RATE as usize;
    let mut out: Vec<i16> = Vec::new();
    let mut sent = false;
    let mut position = 0f64;
    let mut sum = 0f32;
    let mut count = 0u32;

    while let Some(packet) = source.next() {
        let Some((samples, channels)) = source.decode(&packet) else {
            continue;
        };

        for frame in samples.chunks_exact(channels) {
            sum += frame.iter().sum::<f32>() / channels as f32;
            count += 1;
            position += 1.0;

            if position >= step {
                let mono = (sum / count as f32).clamp(-1.0, 1.0);
                let value = (mono * f32::from(i16::MAX)) as i16;

                while position >= step {
                    out.push(value);
                    position -= step;
                }

                sum = 0.0;
                count = 0;
            }
        }

        while out.len() > chunk {
            let cut = quietest(&out, chunk - window, chunk);
            let rest = out.split_off(cut);

            if chunks
                .blocking_send(std::mem::replace(&mut out, rest))
                .is_err()
            {
                return Ok(());
            }

            sent = true;
        }
    }

    if out.is_empty() && !sent {
        return Err(Error::Unsupported);
    }

    if !out.is_empty() {
        let _ = chunks.blocking_send(out);
    }

    Ok(())
}

fn wav(samples: &[i16]) -> Vec<u8> {
    let data = (samples.len() * 2) as u32;
    let mut bytes = Vec::with_capacity(44 + data as usize);

    bytes.extend_from_slice(b"RIFF");
    bytes.extend_from_slice(&(36 + data).to_le_bytes());
    bytes.extend_from_slice(b"WAVEfmt ");
    bytes.extend_from_slice(&16u32.to_le_bytes());
    bytes.extend_from_slice(&1u16.to_le_bytes());
    bytes.extend_from_slice(&1u16.to_le_bytes());
    bytes.extend_from_slice(&SPEECH_RATE.to_le_bytes());
    bytes.extend_from_slice(&(SPEECH_RATE * 2).to_le_bytes());
    bytes.extend_from_slice(&2u16.to_le_bytes());
    bytes.extend_from_slice(&16u16.to_le_bytes());
    bytes.extend_from_slice(b"data");
    bytes.extend_from_slice(&data.to_le_bytes());

    for sample in samples {
        bytes.extend_from_slice(&sample.to_le_bytes());
    }

    bytes
}

async fn request(
    client: &Client,
    base: &str,
    key: &str,
    model: &str,
    language: Option<&str>,
    name: String,
    bytes: Vec<u8>,
) -> Result<Reply> {
    let verbose = !model.starts_with("gpt-4o");
    let mut form = Form::new()
        .part("file", Part::bytes(bytes).file_name(name))
        .text("model", model.to_string())
        .text(
            "response_format",
            if verbose { "verbose_json" } else { "json" },
        );

    if verbose {
        form = form.text("timestamp_granularities[]", "segment");
    }

    if let Some(language) = language {
        form = form.text("language", language.to_string());
    }

    let response = client
        .post(format!("{base}/audio/transcriptions"))
        .bearer_auth(key)
        .multipart(form)
        .send()
        .await
        .map_err(|_| Error::Network)?;

    let status = response.status();

    if status.is_success() {
        return response.json::<Reply>().await.map_err(|_| Error::Provider);
    }

    match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err(Error::BadKey),
        StatusCode::TOO_MANY_REQUESTS => Err(Error::RateLimited),
        StatusCode::PAYLOAD_TOO_LARGE => Err(Error::TooLarge),
        _ => Err(Error::Os(
            response
                .json::<ProviderError>()
                .await
                .map(|body| body.error.message)
                .unwrap_or_else(|_| format!("HTTP {status}")),
        )),
    }
}

struct Collected {
    segments: Vec<Segment>,
    texts: Vec<String>,
    detected: Option<String>,
}

impl Collected {
    fn absorb(&mut self, reply: Reply, offset: f64, length: f64) {
        let text = reply.text.trim().to_string();

        self.detected = self.detected.take().or(reply.language);

        match reply.segments {
            Some(segments) => self.segments.extend(segments.into_iter().map(|s| Segment {
                start: offset + s.start,
                end: offset + s.end,
                text: s.text.trim().to_string(),
                speaker: None,
            })),
            None if !text.is_empty() => self.segments.push(Segment {
                start: offset,
                end: offset + reply.duration.unwrap_or(length),
                text: text.clone(),
                speaker: None,
            }),
            None => {}
        }

        if !text.is_empty() {
            self.texts.push(text);
        }
    }
}

struct Upload<'a> {
    client: Client,
    base: &'a str,
    key: &'a str,
    model: &'a str,
    language: Option<&'a str>,
    progress: &'a Channel<Progress>,
}

impl Upload<'_> {
    async fn send(&self, name: String, bytes: Vec<u8>) -> Result<Reply> {
        request(
            &self.client,
            self.base,
            self.key,
            self.model,
            self.language,
            name,
            bytes,
        )
        .await
    }

    fn report(&self, done: usize, total: usize) {
        let _ = self.progress.send(Progress::Uploading { done, total });
    }

    async fn whole(&self, file: &Path, collected: &mut Collected) -> Result<f64> {
        self.report(0, 1);

        let name = file
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        let source = file.to_path_buf();
        let (bytes, measured) = spawn_blocking(move || {
            std::fs::read(&source).map(|bytes| (bytes, audio::duration(&source)))
        })
        .await??;

        let reply = self.send(name, bytes).await?;
        let duration = measured.or(reply.duration).unwrap_or_default();

        collected.absorb(reply, 0.0, duration);
        self.report(1, 1);

        Ok(duration)
    }

    async fn chunked(&self, file: &Path, collected: &mut Collected) -> Result<f64> {
        let _ = self.progress.send(Progress::Decoding);

        let path = file.to_path_buf();
        let source = spawn_blocking(move || Source::open(&path)).await??;
        let estimate = source
            .duration
            .map(|seconds| (seconds / CHUNK_SECONDS as f64).ceil() as usize)
            .unwrap_or(1);
        let (sender, mut chunks) = mpsc::channel(1);
        let producer = spawn_blocking(move || speech(source, sender));
        let rate = f64::from(SPEECH_RATE);
        let mut offset = 0usize;
        let mut done = 0usize;

        while let Some(samples) = chunks.recv().await {
            self.report(done, estimate.max(done + 1));

            let reply = self
                .send(format!("part-{}.wav", done + 1), wav(&samples))
                .await?;

            collected.absorb(reply, offset as f64 / rate, samples.len() as f64 / rate);

            offset += samples.len();
            done += 1;
        }

        producer.await??;
        self.report(done, done);

        Ok(offset as f64 / rate)
    }
}

#[tauri::command]
pub async fn transcribe(
    path: String,
    provider: String,
    model: String,
    language: Option<String>,
    progress: Channel<Progress>,
) -> Result<Transcribed> {
    known(&provider)?;

    let (base, key) = endpoint(&provider)?;
    let file = Path::new(&path);
    let size = std::fs::metadata(file)?.len();
    let extension = file
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_lowercase();
    let language = language.filter(|code| !code.is_empty());
    let upload = Upload {
        client: Client::builder()
            .timeout(REQUEST_TIMEOUT)
            .build()
            .map_err(|e| Error::Os(e.to_string()))?,
        base: &base,
        key: &key,
        model: &model,
        language: language.as_deref(),
        progress: &progress,
    };
    let mut collected = Collected {
        segments: Vec::new(),
        texts: Vec::new(),
        detected: None,
    };

    let duration = if size <= UPLOAD_LIMIT && UPLOADABLE.contains(&extension.as_str()) {
        upload.whole(file, &mut collected).await?
    } else {
        upload.chunked(file, &mut collected).await?
    };

    let transcript = Transcript {
        version: 1,
        provider,
        host: Url::parse(&base)
            .ok()
            .and_then(|url| url.host_str().map(str::to_string))
            .unwrap_or_default(),
        model,
        language,
        detected_language: collected.detected,
        created_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_millis() as u64)
            .unwrap_or_default(),
        duration,
        text: collected.texts.join(" "),
        segments: collected.segments,
    };
    let saved = save(&path, &transcript);

    Ok(Transcribed { transcript, saved })
}
