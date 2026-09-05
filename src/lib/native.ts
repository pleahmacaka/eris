import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

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
}

export type WindowLabel =
  | "main"
  | "taskbar"
  | "settings"
  | "panel"
  | "onboarding"

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

export const systemAccent = () => invoke<string | null>("system_accent")

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

export const showWindow = (label: WindowLabel) =>
  invoke<void>("show_window", { label })

export const hideWindow = (label: WindowLabel) =>
  invoke<void>("hide_window", { label })

export const toggleWindow = (label: WindowLabel) =>
  invoke<void>("toggle_window", { label })

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
}

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
}

export const notifyIcons = () => invoke<TrayIcon[]>("notify_icons")

export const notifyIconClick = (id: string, button: "left" | "right") =>
  invoke<void>("notify_icon_click", { id, button })

export const onTrayIcons = (handler: () => void) =>
  listen("tray-icons", () => handler())
