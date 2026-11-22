import { describe, expect, test } from "bun:test"
import koCatalog from "#lib/i18n/messages/ko.json"
import { createTranslator } from "#lib/i18n/translate.js"
import {
  AUDIO_PREFS_KEY,
  captureOptions,
  DEFAULT_AUDIO_PREFS,
  deviceOptions,
  labelsHidden,
  loadAudioPrefs,
  resolveDevice,
  saveAudioPrefs,
} from "./devices"

const storage = () => {
  const map = new Map<string, string>()

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

const device = (kind: string, deviceId: string, label: string) => ({
  kind,
  deviceId,
  label,
})

describe("audio preferences", () => {
  test("defaults to the system devices with processing on", () => {
    expect(loadAudioPrefs(storage())).toEqual(DEFAULT_AUDIO_PREFS)
    expect(DEFAULT_AUDIO_PREFS).toEqual({
      inputId: null,
      outputId: null,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    })
  })

  test("round-trips the chosen devices and flags", () => {
    const store = storage()
    const prefs = {
      inputId: "mic-2",
      outputId: "speaker-1",
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: false,
    }

    saveAudioPrefs(store, prefs)

    expect(store.getItem(AUDIO_PREFS_KEY)).not.toBeNull()
    expect(loadAudioPrefs(store)).toEqual(prefs)
  })

  test("falls back per field for malformed storage", () => {
    const store = storage()

    store.setItem(AUDIO_PREFS_KEY, "not json")
    expect(loadAudioPrefs(store)).toEqual(DEFAULT_AUDIO_PREFS)

    store.setItem(AUDIO_PREFS_KEY, JSON.stringify(["mic"]))
    expect(loadAudioPrefs(store)).toEqual(DEFAULT_AUDIO_PREFS)

    store.setItem(
      AUDIO_PREFS_KEY,
      JSON.stringify({ inputId: 7, outputId: "", noiseSuppression: false }),
    )
    expect(loadAudioPrefs(store)).toEqual({
      ...DEFAULT_AUDIO_PREFS,
      noiseSuppression: false,
    })
  })
})

describe("deviceOptions", () => {
  const ko = createTranslator("ko", koCatalog)
  const labeled = (...args: Parameters<typeof deviceOptions>) =>
    deviceOptions(...args).map(option => ({
      id: option.id,
      label: ko(option.label.key, option.label.values),
    }))

  const devices = [
    device("audioinput", "default", "Default - Mic A"),
    device("audioinput", "communications", "Communications - Mic A"),
    device("audioinput", "a", "Mic A"),
    device("audioinput", "b", ""),
    device("audioinput", "a", "Mic A"),
    device("audioinput", "", ""),
    device("audiooutput", "s", "Speaker"),
    device("videoinput", "c", "Camera"),
  ]

  test("keeps one kind without pseudo, empty or duplicate entries", () => {
    expect(labeled(devices, "audioinput")).toEqual([
      { id: "a", label: "Mic A" },
      { id: "b", label: "입력 장치 2" },
    ])
    expect(labeled(devices, "audiooutput")).toEqual([
      { id: "s", label: "Speaker" },
    ])
  })

  test("numbers unlabeled outputs", () => {
    expect(labeled([device("audiooutput", "x", "")], "audiooutput")).toEqual([
      { id: "x", label: "출력 장치 1" },
    ])
  })
})

describe("labelsHidden", () => {
  test("is true only when inputs exist and none has a label", () => {
    expect(labelsHidden([device("audioinput", "", "")])).toBe(true)
    expect(
      labelsHidden([
        device("audioinput", "a", ""),
        device("audiooutput", "s", "Speaker"),
      ]),
    ).toBe(true)
    expect(labelsHidden([device("audioinput", "a", "Mic A")])).toBe(false)
    expect(labelsHidden([device("audiooutput", "s", "")])).toBe(false)
    expect(labelsHidden([])).toBe(false)
  })
})

describe("resolveDevice", () => {
  const options = [
    { id: "a", label: { key: "ui.plain" as const, values: { text: "Mic A" } } },
    { id: "b", label: { key: "ui.plain" as const, values: { text: "Mic B" } } },
  ]

  test("keeps a preferred device that is connected", () => {
    expect(resolveDevice("b", options)).toBe("b")
  })

  test("uses the system default when the device is gone or unset", () => {
    expect(resolveDevice("gone", options)).toBeNull()
    expect(resolveDevice(null, options)).toBeNull()
    expect(resolveDevice("a", [])).toBeNull()
  })
})

describe("captureOptions", () => {
  test("passes the device and the processing flags", () => {
    expect(captureOptions({ ...DEFAULT_AUDIO_PREFS, inputId: "a" })).toEqual({
      deviceId: "a",
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    })
  })

  test("leaves the device unset for the system default", () => {
    expect(
      captureOptions({ ...DEFAULT_AUDIO_PREFS, echoCancellation: false }),
    ).toEqual({
      deviceId: undefined,
      echoCancellation: false,
      noiseSuppression: true,
      autoGainControl: true,
    })
  })
})
