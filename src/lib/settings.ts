import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import { load } from "@tauri-apps/plugin-store"

export type DockStyle = "mac" | "windows"

export type Settings = {
  useSystemAccent: boolean
  dockStyle: DockStyle
  dockHeight: number
  dockWidth: number
  hideSystemTaskbar: boolean
  accentHue: number
  accentSpread: number
  vividness: number
  texture: number
}

export const defaults: Settings = {
  useSystemAccent: true,
  dockStyle: "windows",
  dockHeight: 48,
  dockWidth: 720,
  hideSystemTaskbar: true,
  accentHue: 215,
  accentSpread: 14,
  vividness: 0.06,
  texture: 0.3,
}

const FILE = "settings.json"
const KEY = "settings"
const EVENT = "settings-changed"

export const loadSettings = async (): Promise<Settings> => {
  const store = await load(FILE)
  const saved = await store.get<Partial<Settings>>(KEY)

  return { ...defaults, ...saved }
}

export const saveSettings = async (value: Settings) => {
  const store = await load(FILE)

  await store.set(KEY, value)
  await store.save()
  await emit(EVENT, value)
}

export const onSettings = (handler: (value: Settings) => void) =>
  listen<Settings>(EVENT, event => handler(event.payload))

const hueFromHex = (hex: string) => {
  const [red, green, blue] = [1, 3, 5].map(
    at => Number.parseInt(hex.slice(at, at + 2), 16) / 255,
  )
  const max = Math.max(red, green, blue)
  const span = max - Math.min(red, green, blue)

  if (span === 0) {
    return 0
  }

  const hue =
    max === red
      ? (green - blue) / span + (green < blue ? 6 : 0)
      : max === green
        ? (blue - red) / span + 2
        : (red - green) / span + 4

  return Math.round(hue * 60)
}

export const systemAccentHue = async () => {
  const hex = await invoke<string | null>("system_accent")

  return hex ? hueFromHex(hex) : null
}

export const applyAppearance = async (value: Settings) => {
  const root = document.documentElement
  const hue =
    (value.useSystemAccent ? await systemAccentHue() : null) ?? value.accentHue

  root.style.setProperty("--accent-hue", String(hue))
  root.style.setProperty("--accent-spread", String(value.accentSpread))
  root.style.setProperty("--vividness", String(value.vividness))
  root.style.setProperty("--texture", String(value.texture))
}

export const applyDock = (value: Settings) =>
  invoke<void>("apply_taskbar", {
    height: value.dockHeight,
    width: value.dockStyle === "mac" ? value.dockWidth : 900,
    floating: value.dockStyle === "mac",
    hideSystemTaskbar: value.hideSystemTaskbar,
  })
