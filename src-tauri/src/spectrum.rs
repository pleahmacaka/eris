use tauri::AppHandle;

pub const BANDS: usize = 24;

#[tauri::command]
pub fn spectrum_start(app: AppHandle) {
    win::start(app);
}

#[tauri::command]
pub fn spectrum_stop() {
    win::stop();
}

pub fn bands_from(samples: &[f32], rate: f32, previous: &mut [f32; BANDS]) -> [f32; BANDS] {
    use rustfft::{num_complex::Complex, FftPlanner};

    const SMOOTH_UP: f32 = 0.55;
    const SMOOTH_DOWN: f32 = 0.12;
    const FLOOR_DB: f32 = -78.0;
    const LOW_HZ: f32 = 40.0;

    if samples.is_empty() || rate <= 0.0 {
        return *previous;
    }

    let size = samples.len();
    let mut buffer: Vec<Complex<f32>> = samples
        .iter()
        .enumerate()
        .map(|(index, sample)| {
            let phase = std::f32::consts::TAU * index as f32 / (size - 1).max(1) as f32;
            let window = 0.5 - 0.5 * phase.cos();

            Complex::new(sample * window, 0.0)
        })
        .collect();

    FftPlanner::new().plan_fft_forward(size).process(&mut buffer);

    let bins = size / 2;
    let top = (rate / 2.0).min(16_000.0);
    let ratio = (top / LOW_HZ).powf(1.0 / BANDS as f32);
    let mut next = [0.0f32; BANDS];

    for band in 0..BANDS {
        let start = LOW_HZ * ratio.powi(band as i32);
        let end = start * ratio;
        let first = ((start / rate * size as f32) as usize).max(1);
        let last = ((end / rate * size as f32) as usize).min(bins.saturating_sub(1));

        let peak = (first..=last.max(first))
            .filter_map(|bin| buffer.get(bin))
            .map(|value| value.norm())
            .fold(0.0f32, f32::max);

        let db = 20.0 * (peak / (size as f32 / 4.0)).max(1e-6).log10();
        let level = ((db - FLOOR_DB) / -FLOOR_DB).clamp(0.0, 1.0);
        let rate = if level > previous[band] {
            SMOOTH_UP
        } else {
            SMOOTH_DOWN
        };

        next[band] = previous[band] + (level - previous[band]) * rate;
    }

    *previous = next;

    next
}

#[cfg(target_os = "windows")]
mod win {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    use tauri::{AppHandle, Emitter};
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IAudioCaptureClient, IAudioClient, IMMDeviceEnumerator,
        MMDeviceEnumerator, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK,
    };
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
    };

    use super::{bands_from, BANDS};

    const WINDOW: usize = 1024;
    const TICK: Duration = Duration::from_millis(33);
    const BUFFER_NANOS: i64 = 2_000_000;

    static RUNNING: AtomicBool = AtomicBool::new(false);

    pub fn stop() {
        RUNNING.store(false, Ordering::Relaxed);
    }

    pub fn start(app: AppHandle) {
        if RUNNING.swap(true, Ordering::Relaxed) {
            return;
        }

        std::thread::spawn(move || {
            if let Err(error) = capture(&app) {
                crate::trace(&format!("spectrum capture stopped: {error}"));
            }

            RUNNING.store(false, Ordering::Relaxed);
            let _ = app.emit("spectrum", [0.0f32; BANDS]);
        });
    }

    fn capture(app: &AppHandle) -> windows::core::Result<()> {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
            let client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;
            let format = client.GetMixFormat()?;

            client.Initialize(
                AUDCLNT_SHAREMODE_SHARED,
                AUDCLNT_STREAMFLAGS_LOOPBACK,
                BUFFER_NANOS,
                0,
                format,
                None,
            )?;

            let channels = (*format).nChannels as usize;
            let rate = (*format).nSamplesPerSec as f32;
            let bits = (*format).wBitsPerSample as usize;
            let float = bits == 32;

            CoTaskMemFree(Some(format as *const _));

            let reader: IAudioCaptureClient = client.GetService()?;

            client.Start()?;

            let mut window = vec![0.0f32; WINDOW];
            let mut filled = 0usize;
            let mut previous = [0.0f32; BANDS];

            while RUNNING.load(Ordering::Relaxed) {
                let mut frames = reader.GetNextPacketSize()?;

                if frames == 0 {
                    std::thread::sleep(TICK);
                }

                while frames > 0 {
                    let mut data = std::ptr::null_mut();
                    let mut count = 0u32;
                    let mut flags = 0u32;

                    reader.GetBuffer(&mut data, &mut count, &mut flags, None, None)?;

                    let silent = flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0;

                    for frame in 0..count as usize {
                        let value = if silent || data.is_null() {
                            0.0
                        } else if float {
                            let samples = data as *const f32;

                            (0..channels)
                                .map(|channel| *samples.add(frame * channels + channel))
                                .sum::<f32>()
                                / channels as f32
                        } else {
                            let samples = data as *const i16;

                            (0..channels)
                                .map(|channel| {
                                    f32::from(*samples.add(frame * channels + channel)) / 32768.0
                                })
                                .sum::<f32>()
                                / channels as f32
                        };

                        window[filled] = value;
                        filled += 1;

                        if filled == WINDOW {
                            let bands = bands_from(&window, rate, &mut previous);

                            let _ = app.emit("spectrum", bands);
                            filled = 0;
                        }
                    }

                    reader.ReleaseBuffer(count)?;
                    frames = reader.GetNextPacketSize()?;
                }
            }

            client.Stop()
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win {
    use tauri::AppHandle;

    pub fn start(_app: AppHandle) {}

    pub fn stop() {}
}

#[cfg(test)]
mod tests {
    use super::{bands_from, BANDS};

    #[test]
    fn a_pure_tone_lands_in_one_band() {
        let rate = 48_000.0;
        let samples: Vec<f32> = (0..1024)
            .map(|index| {
                (std::f32::consts::TAU * 1_000.0 * index as f32 / rate).sin() * 0.5
            })
            .collect();

        let mut previous = [0.0f32; BANDS];

        for _ in 0..40 {
            bands_from(&samples, rate, &mut previous);
        }

        let loudest = previous
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.total_cmp(b.1))
            .map(|(index, _)| index)
            .unwrap();

        let low = 40.0 * (16_000.0f32 / 40.0).powf(loudest as f32 / BANDS as f32);
        let high = low * (16_000.0f32 / 40.0).powf(1.0 / BANDS as f32);

        assert!(
            low <= 1_400.0 && high >= 900.0,
            "1 kHz landed in band {loudest} covering {low}..{high}"
        );
    }

    #[test]
    fn silence_stays_at_the_floor() {
        let mut previous = [0.0f32; BANDS];
        let bands = bands_from(&vec![0.0; 1024], 48_000.0, &mut previous);

        assert!(bands.iter().all(|level| *level < 0.05));
    }
}
