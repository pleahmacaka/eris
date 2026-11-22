import type { Message } from "#lib/i18n/translate.js"
export type AudioPrefs = {
  inputId: string | null
  outputId: string | null
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
}

export type AudioProcessing =
  | "echoCancellation"
  | "noiseSuppression"
  | "autoGainControl"

export type DeviceKind = "audioinput" | "audiooutput"

export type DeviceOption = { id: string; label: Message }

type DeviceLike = { deviceId: string; kind: string; label: string }

type PrefsStorage = Pick<Storage, "getItem" | "setItem">

export const AUDIO_PREFS_KEY = "eris.audio"

export const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  inputId: null,
  outputId: null,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

const PSEUDO_DEVICE_IDS = ["default", "communications"]

const deviceId = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : null

const flag = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback

const parseRecord = (raw: string | null): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(raw ?? "")

    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

export const loadAudioPrefs = (storage: PrefsStorage): AudioPrefs => {
  const stored = parseRecord(storage.getItem(AUDIO_PREFS_KEY))

  return {
    inputId: deviceId(stored.inputId),
    outputId: deviceId(stored.outputId),
    echoCancellation: flag(
      stored.echoCancellation,
      DEFAULT_AUDIO_PREFS.echoCancellation,
    ),
    noiseSuppression: flag(
      stored.noiseSuppression,
      DEFAULT_AUDIO_PREFS.noiseSuppression,
    ),
    autoGainControl: flag(
      stored.autoGainControl,
      DEFAULT_AUDIO_PREFS.autoGainControl,
    ),
  }
}

export const saveAudioPrefs = (storage: PrefsStorage, prefs: AudioPrefs) =>
  storage.setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs))

export const deviceOptions = (
  devices: DeviceLike[],
  kind: DeviceKind,
): DeviceOption[] => {
  const seen = new Set<string>()
  const options: DeviceOption[] = []

  for (const device of devices) {
    if (
      device.kind !== kind ||
      device.deviceId === "" ||
      PSEUDO_DEVICE_IDS.includes(device.deviceId) ||
      seen.has(device.deviceId)
    ) {
      continue
    }

    seen.add(device.deviceId)
    options.push({
      id: device.deviceId,
      label: device.label
        ? { key: "ui.plain", values: { text: device.label } }
        : {
            key: "devices.fallback",
            values: { kind, index: options.length + 1 },
          },
    })
  }

  return options
}

export const labelsHidden = (devices: DeviceLike[]) => {
  const inputs = devices.filter(device => device.kind === "audioinput")

  return inputs.length > 0 && inputs.every(device => device.label === "")
}

export const resolveDevice = (
  preferredId: string | null,
  options: DeviceOption[],
) => (options.some(option => option.id === preferredId) ? preferredId : null)

export const captureOptions = (prefs: AudioPrefs) => ({
  deviceId: prefs.inputId ?? undefined,
  echoCancellation: prefs.echoCancellation,
  noiseSuppression: prefs.noiseSuppression,
  autoGainControl: prefs.autoGainControl,
})
