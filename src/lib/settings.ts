import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import { load } from "@tauri-apps/plugin-store"
import type { SyncedCollection } from "./sync/protocol"

export type DockStyle = "windows" | "mac"
export type DockEdge = "bottom" | "top"
export type DockAlign = "start" | "center"
export type LauncherTrigger = "win" | "shortcut" | "both"
export type ThemeMode = "dark" | "light" | "system"
export type Background = "aura" | "glass" | "solid"
export type Density = "compact" | "cozy"
export type WebSearchEngine = "google" | "duckduckgo" | "bing" | "naver"
export type TodoSort = "manual" | "due" | "priority"

export type SyncSettings = {
  enabled: boolean
  url: string
  token: string
  intervalMinutes: number
  collections: Record<SyncedCollection, boolean>
}

export type DeviceSettings = {
  deviceId: string
  deviceName: string
  onboarded: boolean
  dockStyle: DockStyle
  dockEdge: DockEdge
  dockAlign: DockAlign
  dockHeight: number
  dockWidth: number
  dockIconSize: number
  dockAutoHide: boolean
  dockMonitor: string | null
  hideSystemTaskbar: boolean
  showRunningApps: boolean
  showTrayIcons: boolean
  showKeymap: boolean
  showBattery: boolean
  showVolume: boolean
  showMedia: boolean
  showMeters: boolean
  showNetwork: boolean
  showSeconds: boolean
  clock24h: boolean
  launcherTrigger: LauncherTrigger
  launcherShortcut: string
  autostart: boolean
  pinnedApps: string[]
  trayOrder: string[]
  sync: SyncSettings
}

export type Appearance = {
  mode: ThemeMode
  background: Background
  useSystemAccent: boolean
  accentHue: number
  accentSpread: number
  vividness: number
  texture: number
  radius: number
  blur: number
  fontScale: number
  surfaceOpacity: number
  dockOpacity: number
  density: Density
  motion: boolean
}

export type Profile = {
  presetId: string
  appearance: Appearance
  launcher: {
    maxResults: number
    showWindows: boolean
    showCommands: boolean
    showTodos: boolean
    calculator: boolean
    webSearch: WebSearchEngine
  }
  calendar: {
    weekStartsOn: 0 | 1
    showWeekNumbers: boolean
    reminderMinutes: number
  }
  todo: {
    showCompleted: boolean
    sortBy: TodoSort
  }
}

export const defaultAppearance: Appearance = {
  mode: "dark",
  background: "aura",
  useSystemAccent: true,
  accentHue: 215,
  accentSpread: 14,
  vividness: 0.06,
  texture: 0.3,
  radius: 1,
  blur: 1,
  fontScale: 1,
  surfaceOpacity: 1,
  dockOpacity: 1,
  density: "cozy",
  motion: true,
}

export const defaultProfile: Profile = {
  presetId: "aurora",
  appearance: defaultAppearance,
  launcher: {
    maxResults: 8,
    showWindows: true,
    showCommands: true,
    showTodos: true,
    calculator: true,
    webSearch: "google",
  },
  calendar: {
    weekStartsOn: 1,
    showWeekNumbers: false,
    reminderMinutes: 10,
  },
  todo: {
    showCompleted: false,
    sortBy: "manual",
  },
}

export const defaultSync: SyncSettings = {
  enabled: false,
  url: "",
  token: "",
  intervalMinutes: 5,
  collections: {
    todos: true,
    events: true,
    profile: true,
    presets: true,
    notes: true,
  },
}

export const defaultDevice: DeviceSettings = {
  deviceId: "",
  deviceName: "",
  onboarded: false,
  dockStyle: "windows",
  dockEdge: "bottom",
  dockAlign: "center",
  dockHeight: 48,
  dockWidth: 720,
  dockIconSize: 20,
  dockAutoHide: false,
  dockMonitor: null,
  hideSystemTaskbar: true,
  showRunningApps: true,
  showTrayIcons: true,
  showKeymap: false,
  showBattery: true,
  showVolume: true,
  showMedia: true,
  showMeters: false,
  showNetwork: true,
  showSeconds: false,
  clock24h: false,
  launcherTrigger: "both",
  launcherShortcut: "Alt+Space",
  autostart: false,
  pinnedApps: [],
  trayOrder: [],
  sync: defaultSync,
}

const FILE = "settings.json"
const DEVICE_KEY = "device"
const PROFILE_KEY = "profile"
export const DEVICE_EVENT = "settings-changed"
export const PROFILE_EVENT = "profile-changed"

export const loadDevice = async (): Promise<DeviceSettings> => {
  const store = await load(FILE)
  const saved = await store.get<Partial<DeviceSettings>>(DEVICE_KEY)

  return {
    ...defaultDevice,
    ...saved,
    sync: {
      ...defaultSync,
      ...saved?.sync,
      collections: { ...defaultSync.collections, ...saved?.sync?.collections },
    },
  }
}

export const saveDevice = async (value: DeviceSettings) => {
  const store = await load(FILE)

  await store.set(DEVICE_KEY, value)
  await store.save()
  await emit(DEVICE_EVENT, value)
}

export const onDevice = (handler: (value: DeviceSettings) => void) =>
  listen<DeviceSettings>(DEVICE_EVENT, event => handler(event.payload))

export const withProfileDefaults = (
  saved?: Partial<Profile> | null,
): Profile => ({
  ...defaultProfile,
  ...saved,
  appearance: { ...defaultAppearance, ...saved?.appearance },
  launcher: { ...defaultProfile.launcher, ...saved?.launcher },
  calendar: { ...defaultProfile.calendar, ...saved?.calendar },
  todo: { ...defaultProfile.todo, ...saved?.todo },
})

export const loadProfile = async (): Promise<Profile> => {
  const store = await load(FILE)

  return withProfileDefaults(await store.get<Partial<Profile>>(PROFILE_KEY))
}

export const saveProfile = async (value: Profile) => {
  const store = await load(FILE)
  const profile = withProfileDefaults(value)

  await store.set(PROFILE_KEY, profile)
  await store.save()
  await emit(PROFILE_EVENT, profile)
}

export const onProfile = (handler: (value: Profile) => void) =>
  listen<Profile>(PROFILE_EVENT, event => handler(event.payload))

export const systemAccentHue = async () => {
  const hex = await invoke<string | null>("system_accent")

  return hex ? hueFromHex(hex) : null
}

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
