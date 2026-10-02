import { Channel } from "@tauri-apps/api/core"
import { call } from "../../native"

export type Provider = "groq" | "openai" | "custom"

export type Segment = {
  start: number
  end: number
  text: string
  speaker?: string
}

export type Transcript = {
  version: number
  provider: Provider
  host: string
  model: string
  language: string | null
  detectedLanguage: string | null
  createdAt: number
  duration: number
  text: string
  segments: Segment[]
}

export type Waveform = {
  peaks: number[] | null
  duration: number | null
  size: number
}

export type Progress =
  | { stage: "decoding" }
  | { stage: "uploading"; done: number; total: number }

export type KeyStatus = { saved: boolean; base: string | null }

export const audioWaveform = (path: string) =>
  call<Waveform>("audio_waveform", { path })

export const readTranscript = (path: string) =>
  call<Transcript | null>("read_transcript", { path })

export const transcribe = (
  path: string,
  provider: Provider,
  model: string,
  language: string,
  onProgress: (progress: Progress) => void,
) => {
  const progress = new Channel<Progress>()

  progress.onmessage = onProgress

  return call<{ transcript: Transcript; saved: boolean }>("transcribe", {
    path,
    provider,
    model,
    language: language || null,
    progress,
  })
}

export const keyStatus = (provider: Provider) =>
  call<KeyStatus>("transcribe_key_status", { provider })

export const saveKey = (provider: Provider, key: string, base: string | null) =>
  call<KeyStatus>("save_transcribe_key", {
    provider,
    key,
    base,
  })

export const clearKey = (provider: Provider) =>
  call<void>("clear_transcribe_key", { provider })

export const clock = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(whole / 3600)
  const minutes = String(Math.floor((whole % 3600) / 60)).padStart(2, "0")
  const rest = String(whole % 60).padStart(2, "0")

  return hours ? `${hours}:${minutes}:${rest}` : `${minutes}:${rest}`
}

const PEAK_BUCKETS = 1_000

export const decodePeaks = async (url: string) => {
  const data = await fetch(url).then(response => response.arrayBuffer())
  const decoded = await new OfflineAudioContext(1, 1, 8_000).decodeAudioData(
    data,
  )
  const samples = decoded.getChannelData(0)
  const span = samples.length / PEAK_BUCKETS
  const found = Array.from({ length: PEAK_BUCKETS }, (_, index) => {
    let top = 0

    for (let at = Math.floor(index * span); at < (index + 1) * span; at++) {
      top = Math.max(top, Math.abs(samples[at]))
    }

    return top
  })
  const loudest = Math.max(...found, Number.EPSILON)

  return found.map(value => Math.round((value / loudest) * 255))
}
