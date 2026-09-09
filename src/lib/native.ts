import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import type { Features } from "$lib/settings"

export type AppKind = "shortcut" | "store" | "exe"

export type AppEntry = {
  id: string
  name: string
  path: string
  kind: AppKind
  subtitle: string
}

export type WindowEntry = {
  hwnd: number
  title: string
  process: string
  pid: number
  minimized: boolean
}

export type Battery = { percent: number; charging: boolean }

export type Volume = { level: number; muted: boolean }

export type SystemInfo = {
  battery: Battery | null
  volume: Volume | null
}

export type PowerAction =
  | "lock"
  | "sleep"
  | "hibernate"
  | "shutdown"
  | "restart"
  | "signout"

export type TaskbarLayout = {
  edge: "bottom" | "top"
  height: number
  width: number
  floating: boolean
  autoHide: boolean
  hideSystemTaskbar: boolean
  monitor?: string | null
  desktop?: boolean
}

export type WindowLabel =
  | "main"
  | "taskbar"
  | "settings"
  | "panel"
  | "onboarding"
  | "chat"
  | "files"

export const listApps = () => invoke<AppEntry[]>("list_apps")

export const pinnedApps = () => invoke<AppEntry[]>("pinned_apps")

export const launchApp = (path: string, admin = false) =>
  invoke<void>("launch_app", { path, admin })

export const openLocation = (path: string) =>
  invoke<void>("open_location", { path })

export const appIcon = (path: string) =>
  invoke<string | null>("app_icon", { path })

export const listWindows = () => invoke<WindowEntry[]>("list_windows")

export const activateWindow = (hwnd: number) =>
  invoke<void>("activate_window", { hwnd })

export const closeWindow = (hwnd: number) =>
  invoke<void>("close_window", { hwnd })

export const minimizeWindow = (hwnd: number) =>
  invoke<void>("minimize_window", { hwnd })

export const previewShow = (windows: number[], center: number) =>
  invoke<void>("preview_show", { windows, center })

export const previewHide = () => invoke<void>("preview_hide")

export const systemInfo = () => invoke<SystemInfo>("system_info")

export const setVolume = (level: number) =>
  invoke<void>("set_volume", { level })

export const toggleMute = () => invoke<void>("toggle_mute")

export type AudioDevice = {
  id: string
  name: string
  default: boolean
}

export const audioDevices = () => invoke<AudioDevice[]>("audio_devices")

export const setAudioDevice = (id: string) =>
  invoke<void>("set_audio_device", { id })

export const powerAction = (action: PowerAction) =>
  invoke<void>("power_action", { action })

export const emptyRecycleBin = () => invoke<void>("empty_recycle_bin")

export const extendTaskbar = (px: number) =>
  invoke<void>("extend_taskbar", { px })

export const applyTaskbar = (layout: TaskbarLayout) =>
  invoke<void>("apply_taskbar", { layout })

export const setWinKeyCapture = (enabled: boolean) =>
  invoke<void>("set_win_key_capture", { enabled })

export const setLauncherShortcut = (shortcut: string | null) =>
  invoke<void>("set_launcher_shortcut", { shortcut })

export const setChatShortcut = (shortcut: string | null) =>
  invoke<void>("set_chat_shortcut", { shortcut })

export const showWindow = (label: WindowLabel) =>
  invoke<void>("show_window", { label })

export const hideWindow = (label: WindowLabel) =>
  invoke<void>("hide_window", { label })

export const toggleWindow = (label: WindowLabel) =>
  invoke<void>("toggle_window", { label })

export type FileEntry = {
  name: string
  path: string
  directory: boolean
  size: number
  modified: number
  hidden: boolean
}

export type FilePlace = {
  name: string
  path: string
  kind: "folder" | "drive"
  free: number
  total: number
}

export type FileListing = {
  path: string
  parent: string | null
  entries: FileEntry[]
}

export const listDir = (path: string) =>
  invoke<FileListing>("list_dir", { path })

export const filePlaces = () => invoke<FilePlace[]>("file_places")

export const searchDir = (root: string, query: string) =>
  invoke<FileEntry[]>("search_dir", { root, query })

export const createFolder = (path: string, name: string) =>
  invoke<string>("create_folder", { path, name })

export const renameEntry = (path: string, name: string) =>
  invoke<string>("rename_entry", { path, name })

export const deleteEntries = (paths: string[], permanent = false) =>
  invoke<void>("delete_entries", { paths, permanent })

export const transferEntries = (
  paths: string[],
  target: string,
  cut: boolean,
) => invoke<void>("transfer_entries", { paths, target, cut })

export type ChatRect = { x: number; y: number; width: number; height: number }

export type ChatArea = {
  width: number
  height: number
  monitors: ChatRect[]
  home: number
}

export type Transcript = {
  id: string
  title: string
  modified: number
  messages: number
}

export type TranscriptMessage = { role: string; text: string }

export type ClaudeStart = {
  key: string
  cwd: string | null
  resume: string | null
  plain: boolean
  permissionMode: string
  model: string
  effort: string
  thinking: string
  autoCompact: string
  language: string
  budget: number
  systemPrompt: string
}

export const claudeWhich = () => invoke<string | null>("claude_which")

export const claudeStart = (options: ClaudeStart) =>
  invoke<void>("claude_start", { options })

export const claudeSend = (key: string, line: string) =>
  invoke<void>("claude_send", { key, line })

export const claudeStop = (key: string) => invoke<void>("claude_stop", { key })

export const claudeSessions = (cwd: string | null) =>
  invoke<Transcript[]>("claude_sessions", { cwd })

export const claudeTranscript = (cwd: string | null, id: string) =>
  invoke<TranscriptMessage[]>("claude_transcript", { cwd, id })

export const chatArea = () => invoke<ChatArea | null>("chat_area")

export const setFeatures = (features: Features) =>
  invoke<void>("set_features", { features })

export const chatFrame = (frame: number[], rects: number[][]) =>
  invoke<void>("chat_frame", { frame, rects })

export const onChatToggle = (handler: () => void) =>
  listen("chat-toggle", () => handler())

export const openUrl = (url: string) => invoke<void>("open_url", { url })

export const runCommand = (command: string) =>
  invoke<void>("run_command", { command })

export const machineName = () => invoke<string>("machine_name")

export const onWindowShown = (label: WindowLabel, handler: () => void) =>
  listen<WindowLabel>("window-shown", event => {
    if (event.payload === label) {
      handler()
    }
  })

export type ClipEntry = {
  id: string
  text: string
  at: number
  pinned: boolean
}

export const clipboardHistory = () => invoke<ClipEntry[]>("clipboard_history")

export const clipboardCopy = (id: string) =>
  invoke<void>("clipboard_copy", { id })

export const clipboardPaste = (id: string) =>
  invoke<void>("clipboard_paste", { id })

export const clipboardRemove = (id: string) =>
  invoke<void>("clipboard_remove", { id })

export const clipboardPin = (id: string, pinned: boolean) =>
  invoke<void>("clipboard_pin", { id, pinned })

export const clipboardClear = () => invoke<void>("clipboard_clear")

export const onDockEdge = (handler: (atEdge: boolean) => void) =>
  listen<{ atEdge: boolean }>("dock-edge", e => handler(e.payload.atEdge))

export const onDockFullscreen = (handler: (fullscreen: boolean) => void) =>
  listen<{ fullscreen: boolean }>("dock-fullscreen", e =>
    handler(e.payload.fullscreen),
  )

export const openDataFolder = () => invoke<void>("open_data_folder")

export const clearIconCache = () => invoke<void>("clear_icon_cache")

export type MonitorInfo = {
  id: string
  name: string
  primary: boolean
  x: number
  y: number
  width: number
  height: number
  scale: number
}

export const listMonitors = () => invoke<MonitorInfo[]>("list_monitors")

export type MediaStatus = {
  title: string
  artist: string
  app: string
  playing: boolean
}

export type MediaAction = "playpause" | "next" | "previous" | "stop"

export const mediaStatus = () => invoke<MediaStatus | null>("media_status")

export const mediaCommand = (action: MediaAction) =>
  invoke<void>("media_command", { action })

export type NetworkInfo = {
  kind: "wifi" | "ethernet" | "none"
  name: string
  connected: boolean
  ssid: string
  signal: number
}

export type RadioKind = "wifi" | "bluetooth" | "other"

export type RadioState = "on" | "off" | "disabled" | "unknown"

export type RadioInfo = { kind: RadioKind; state: RadioState }

export const radios = () => invoke<RadioInfo[]>("radios")

export const setRadio = (kind: RadioKind, on: boolean) =>
  invoke<void>("set_radio", { kind, on })

export const bluetoothDevices = () => invoke<string[]>("bluetooth_devices")

export type QuickAction =
  | "notifications"
  | "quicksettings"
  | "taskview"
  | "desktop"

export const quickAction = (action: QuickAction) =>
  invoke<void>("quick_action", { action })

export type InputLanguage = { label: string; layouts: number }

export const inputLanguage = () =>
  invoke<InputLanguage | null>("input_language")

export const cycleInputLanguage = () => invoke<void>("cycle_input_language")

export type Meters = {
  cpu: number
  memory: number
  memoryUsedMb: number
  memoryTotalMb: number
  network: NetworkInfo | null
}

export const systemMeters = () => invoke<Meters>("system_meters")

export type UsageWindow = {
  used: number
  resetsAt: string | null
}

export type ClaudeUsage = {
  source: string
  updatedAt: string | null
  fiveHour: UsageWindow | null
  sevenDay: UsageWindow | null
}

export const spectrumStart = () => invoke<void>("spectrum_start")

export const spectrumStop = () => invoke<void>("spectrum_stop")

export const claudeUsage = (path: string | null) =>
  invoke<ClaudeUsage | null>("claude_usage", { path })

export const usageBridgeInstalled = () =>
  invoke<boolean>("usage_bridge_installed")

export const installUsageBridge = (enable: boolean) =>
  invoke<void>("install_usage_bridge", { enable })

export type TrayIcon = {
  id: string
  tooltip: string
  icon: string | null
  hidden: boolean
  promoted: boolean
}

export const notifyIcons = () => invoke<TrayIcon[]>("notify_icons")

export const notifyIconClick = (id: string, button: "left" | "right") =>
  invoke<void>("notify_icon_click", { id, button })

export const notifyIconPromote = (id: string, promoted: boolean) =>
  invoke<void>("notify_icon_promote", { id, promoted })

export const onTrayIcons = (handler: () => void) =>
  listen("tray-icons", () => handler())

export const editMode = (on: boolean) => invoke<void>("edit_mode", { on })

export const editRaise = () => invoke<void>("edit_raise")

export type Notice = {
  id: number
  app: string
  title: string
  body: string
  arrived: number
}

export const noticesList = () => invoke<Notice[]>("notices_list")

export const noticesUnseen = () => invoke<number>("notices_unseen")

export const noticesSeen = () => invoke<void>("notices_seen")

export const noticesDismiss = (ids: number[]) =>
  invoke<void>("notices_dismiss", { ids })

export const noticesOpenPanel = () => invoke<void>("notices_open_panel")

export const noticesTakeIntent = () => invoke<boolean>("notices_take_intent")
