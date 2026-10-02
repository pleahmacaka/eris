import { persisted } from "../../store/persisted.svelte"
import type { Provider } from "./audio"

export type TranscribeSettings = {
  provider: Provider
  model: string
  language: string
}

export const MODELS: Record<Provider, string[]> = {
  groq: ["whisper-large-v3-turbo", "whisper-large-v3"],
  openai: ["whisper-1", "gpt-4o-transcribe", "gpt-4o-mini-transcribe"],
  custom: [],
}

export const LANGUAGES = ["", "ko", "en", "ja", "zh", "es", "fr", "de"]

export const transcribeSettings = persisted<TranscribeSettings>(
  "eris-files.transcribe",
  { provider: "groq", model: MODELS.groq[0], language: "" },
)
