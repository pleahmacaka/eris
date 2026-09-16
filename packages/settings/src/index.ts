import type { Language } from "@eris/i18n"
import type { SyncedCollection } from "@eris/sync/protocol"
import { invoke } from "@tauri-apps/api/core"
import { emit, listen } from "@tauri-apps/api/event"
import { load } from "@tauri-apps/plugin-store"

export type DockStyle = "windows" | "mac" | "uchiwa"
export type DockEdge = "bottom" | "top"
export type DockAlign = "start" | "center"
export type DockSide = "left" | "right"
export type ClockAlign = "start" | "center" | "end"
export type DockBackground = "inherit" | Background
export type SpectrumStyle = "bars" | "mirror" | "wave" | "dots"
export type LauncherTrigger = "win" | "shortcut" | "both"
export type ThemeMode = "dark" | "light" | "system"
export type Background = "aura" | "glass" | "solid"
export type Density = "compact" | "cozy"
export type Features = {
  dock: boolean
  launcher: boolean
  chat: boolean
  calendar: boolean
}

export type DockWidgetKind = "lead" | "apps" | "tray" | "spacer"

export type DockWidget = {
  id: string
  kind: DockWidgetKind
  size: number
}
export type WebSearchEngine = "google" | "duckduckgo" | "bing" | "naver"
export type TodoSort = "manual" | "due" | "priority"
export type ChatEffort = "" | "low" | "medium" | "high" | "xhigh" | "max"
export type ChatPermission =
  | "default"
  | "acceptEdits"
  | "plan"
  | "auto"
  | "dontAsk"
  | "bypassPermissions"
export type ChatTri = "default" | "on" | "off"
export type ChatHover = "none" | "title" | "preview"
export type ChatQueueMode = "afterTool" | "afterReply"
export type TraySlot =
  | "taskview"
  | "claude"
  | "tray"
  | "media"
  | "input"
  | "meters"
  | "bluetooth"
  | "battery"
  | "volume"
  | "clock"
  | "bell"
  | "settings"
  | "desktop"

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
  language: Language
  dockStyle: DockStyle
  dockEdge: DockEdge
  dockAlign: DockAlign
  dockHeight: number
  dockWidth: number
  dockIconSize: number
  dockAutoHide: boolean
  dockHideAnimation: boolean
  dockDesktop: boolean
  topBar: boolean
  panelPosition: "left" | "center" | "right"
  dockSeparators: boolean
  clockAlign: ClockAlign
  editMode: boolean
  features: Features
  chatSnap: number
  chatModel: string
  chatEffort: ChatEffort
  chatPermission: ChatPermission
  chatThinking: ChatTri
  chatAutoCompact: ChatTri
  chatLanguage: string
  chatBudget: number
  chatSystemPrompt: string
  chatHover: ChatHover
  chatMultiBubble: boolean
  chatBubbleColors: boolean
  chatQueueMode: ChatQueueMode
  dockMonitor: string | null
  hideSystemTaskbar: boolean
  showLauncherButton: boolean
  showRunningApps: boolean
  showTrayIcons: boolean
  showKeymap: boolean
  showSettingsButton: boolean
  showClaudeUsage: boolean
  claudeUsageSource: string
  claudeUsageSide: DockSide
  claudeUsageStacked: boolean
  mediaSide: DockSide
  showSpectrum: boolean
  spectrumStyle: SpectrumStyle
  showBattery: boolean
  showVolume: boolean
  showMedia: boolean
  showMeters: boolean
  showNetwork: boolean
  showBluetooth: boolean
  showNotifications: boolean
  showDesktopButton: boolean
  showTaskView: boolean
  showInputLanguage: boolean
  showSeconds: boolean
  clock24h: boolean
  launcherTrigger: LauncherTrigger
  launcherShortcut: string
  chatShortcut: string
  autostart: boolean
  pinnedApps: string[]
  hiddenApps: string[]
  dockOrder: string[]
  dockWidgets: DockWidget[]
  trayOrder: string[]
  trayHidden: string[]
  traySlots: TraySlot[]
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
  dockBackground: DockBackground
  dockBlur: number
  dockRadius: number
  dockBorder: boolean
  dockTint: number
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
    region: string
  }
  todo: {
    showCompleted: boolean
    sortBy: TodoSort
  }
}

export const defaultAppearance: Appearance = {
  mode: "system",
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
  dockBackground: "inherit",
  dockBlur: 1,
  dockRadius: 1,
  dockBorder: true,
  dockTint: 0,
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
    weekStartsOn: 0,
    showWeekNumbers: false,
    reminderMinutes: 10,
    region: "system",
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
  language: "system",
  dockStyle: "windows",
  dockEdge: "bottom",
  dockAlign: "center",
  dockHeight: 48,
  dockWidth: 720,
  dockIconSize: 24,
  dockAutoHide: false,
  dockHideAnimation: true,
  dockDesktop: false,
  topBar: false,
  panelPosition: "right",
  dockSeparators: true,
  clockAlign: "end",
  editMode: true,
  features: { dock: true, launcher: true, chat: false, calendar: true },
  chatSnap: 15,
  chatModel: "",
  chatEffort: "",
  chatPermission: "default",
  chatThinking: "default",
  chatAutoCompact: "default",
  chatLanguage: "",
  chatBudget: 0,
  chatSystemPrompt: "",
  chatHover: "title",
  chatMultiBubble: true,
  chatBubbleColors: true,
  chatQueueMode: "afterReply",
  dockMonitor: null,
  hideSystemTaskbar: true,
  showLauncherButton: true,
  showRunningApps: true,
  showTrayIcons: true,
  showKeymap: false,
  showSettingsButton: false,
  showClaudeUsage: true,
  claudeUsageSource: "",
  claudeUsageSide: "left",
  claudeUsageStacked: false,
  mediaSide: "left",
  showSpectrum: true,
  spectrumStyle: "bars",
  showBattery: true,
  showVolume: true,
  showMedia: true,
  showMeters: false,
  showNetwork: true,
  showBluetooth: true,
  showNotifications: true,
  showDesktopButton: true,
  showTaskView: false,
  showInputLanguage: true,
  showSeconds: false,
  clock24h: false,
  launcherTrigger: "both",
  launcherShortcut: "Alt+Space",
  chatShortcut: "Ctrl+Space",
  autostart: true,
  pinnedApps: [],
  hiddenApps: [],
  dockOrder: [],
  dockWidgets: [
    { id: "lead", kind: "lead", size: 0 },
    { id: "apps", kind: "apps", size: 0 },
    { id: "tray", kind: "tray", size: 0 },
  ],
  trayOrder: [],
  trayHidden: [],
  traySlots: [
    "taskview",
    "claude",
    "tray",
    "media",
    "input",
    "meters",
    "bluetooth",
    "battery",
    "volume",
    "clock",
    "bell",
    "settings",
    "desktop",
  ],
  sync: defaultSync,
}

const FILE = "settings.json"
const DEVICE_KEY = "device"
const PROFILE_KEY = "profile"
export const DEVICE_EVENT = "settings-changed"
export const PROFILE_EVENT = "profile-changed"

const WIDGET_KINDS: DockWidgetKind[] = ["lead", "apps", "tray", "spacer"]

export const sanitizeWidgets = (
  saved: DockWidget[] | undefined,
): DockWidget[] => {
  const seen = new Set<string>()
  const list = (saved ?? []).filter(
    widget =>
      WIDGET_KINDS.includes(widget.kind) &&
      !seen.has(widget.id) &&
      seen.add(widget.id),
  )

  for (const widget of defaultDevice.dockWidgets) {
    if (!list.some(w => w.kind === widget.kind)) {
      list.push({ ...widget })
    }
  }

  return list.map(widget => ({
    ...widget,
    size: widget.kind === "spacer" ? Math.max(8, widget.size || 24) : 0,
  }))
}

export const loadDevice = async (): Promise<DeviceSettings> => {
  const store = await load(FILE)
  const saved = await store.get<Partial<DeviceSettings>>(DEVICE_KEY)
  const migrated =
    (saved?.dockAlign as string) === "uchiwa"
      ? { dockStyle: "uchiwa" as DockStyle, dockAlign: "center" as DockAlign }
      : {}

  return {
    ...defaultDevice,
    ...saved,
    ...migrated,
    dockWidgets: sanitizeWidgets(saved?.dockWidgets),
    features: { ...defaultDevice.features, ...saved?.features },
    sync: {
      ...defaultSync,
      ...saved?.sync,
      collections: { ...defaultSync.collections, ...saved?.sync?.collections },
    },
  }
}

// writes serialize so a read-modify-write cannot interleave with another save
let writing: Promise<unknown> = Promise.resolve()

const writeDevice = async (value: DeviceSettings) => {
  const store = await load(FILE)

  await store.set(DEVICE_KEY, value)
  await store.save()
  await emit(DEVICE_EVENT, value)
}

export const saveDevice = (value: DeviceSettings) => {
  const next = writing.then(() => writeDevice(value))

  writing = next.then(
    () => undefined,
    () => undefined,
  )

  return next
}

export const updateDevice = (
  change: (device: DeviceSettings) => DeviceSettings,
) => {
  const next = writing.then(async () => {
    const device = await loadDevice()

    await writeDevice(change(device))
  })

  writing = next.then(
    () => undefined,
    () => undefined,
  )

  return next
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
