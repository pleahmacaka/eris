import type {
  AppEntry,
  AudioDevice,
  ClaudeUsage,
  ClipEntry,
  InputLanguage,
  MediaStatus,
  Meters,
  MonitorInfo,
  Notice,
  P2pStatus,
  RadioInfo,
  SystemInfo,
  TrayIcon,
  WindowEntry,
} from "$lib/native"

type Args = Record<string, unknown>

const HOUR = 3_600_000

const ago = (minutes: number) => Date.now() - minutes * 60_000

const windows: WindowEntry[] = [
  {
    hwnd: 101,
    title: "eris - Visual Studio Code",
    process: "Code.exe",
    pid: 4100,
    minimized: false,
  },
  {
    hwnd: 102,
    title: "pleahmacaka/eris - Chrome",
    process: "chrome.exe",
    pid: 4200,
    minimized: false,
  },
  {
    hwnd: 103,
    title: "Downloads",
    process: "explorer.exe",
    pid: 4300,
    minimized: true,
  },
  {
    hwnd: 104,
    title: "Windows PowerShell",
    process: "WindowsTerminal.exe",
    pid: 4400,
    minimized: false,
  },
]

const app = (name: string, path: string, subtitle = ""): AppEntry => ({
  id: path,
  name,
  path,
  kind: "exe",
  subtitle,
})

const apps: AppEntry[] = [
  app(
    "Visual Studio Code",
    "C:\\Program Files\\Microsoft VS Code\\Code.exe",
    "Code editor",
  ),
  app(
    "Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "Web browser",
  ),
  app("File Explorer", "C:\\Windows\\explorer.exe"),
  app(
    "Terminal",
    "C:\\Program Files\\WindowsApps\\Microsoft.WindowsTerminal\\WindowsTerminal.exe",
  ),
  app("Spotify", "C:\\Users\\studio\\AppData\\Roaming\\Spotify\\Spotify.exe"),
  app("Discord", "C:\\Users\\studio\\AppData\\Local\\Discord\\Discord.exe"),
]

const monitor: MonitorInfo = {
  id: "DISPLAY1",
  name: "Studio display",
  primary: true,
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  scale: 1,
}

const notices: Notice[] = [
  {
    id: 1,
    app: "Discord",
    title: "arix",
    body: "Build is green, merging now",
    arrived: ago(3),
  },
  {
    id: 2,
    app: "Calendar",
    title: "Design review",
    body: "Starts in 10 minutes",
    arrived: ago(12),
  },
  {
    id: 3,
    app: "Windows Update",
    title: "Restart required",
    body: "Updates are ready to install",
    arrived: ago(95),
  },
]

const trayIcons: TrayIcon[] = [
  {
    id: "discord",
    tooltip: "Discord",
    icon: null,
    hidden: false,
    promoted: true,
  },
  {
    id: "onedrive",
    tooltip: "OneDrive",
    icon: null,
    hidden: false,
    promoted: true,
  },
  { id: "steam", tooltip: "Steam", icon: null, hidden: true, promoted: false },
]

const clips: ClipEntry[] = [
  { id: "c1", text: "bun run studio", at: ago(2), pinned: true },
  {
    id: "c2",
    text: "https://github.com/pleahmacaka/eris",
    at: ago(30),
    pinned: false,
  },
]

const systemInfo: SystemInfo = {
  battery: { percent: 76, charging: false },
  volume: { level: 0.42, muted: false },
}

const meters: Meters = {
  cpu: 18,
  memory: 54,
  memoryUsedMb: 17_600,
  memoryTotalMb: 32_768,
  network: {
    kind: "wifi",
    name: "Wi-Fi",
    connected: true,
    ssid: "studio",
    signal: 82,
  },
}

const media: MediaStatus = {
  title: "Midnight City",
  artist: "M83",
  app: "Spotify",
  playing: true,
}

const audio: AudioDevice[] = [
  { id: "speakers", name: "Speakers", default: true },
  { id: "headphones", name: "WH-1000XM5", default: false },
]

const radios: RadioInfo[] = [
  { kind: "wifi", state: "on" },
  { kind: "bluetooth", state: "on" },
]

const input: InputLanguage = { label: "한", layouts: 2 }

const usage = (): ClaudeUsage => ({
  source: "studio",
  updatedAt: new Date().toISOString(),
  fiveHour: {
    used: 42,
    resetsAt: new Date(Date.now() + 2 * HOUR).toISOString(),
  },
  sevenDay: {
    used: 18,
    resetsAt: new Date(Date.now() + 96 * HOUR).toISOString(),
  },
})

const p2p: P2pStatus = { nodeId: "studio", paired: false, peers: [] }

export const fixtures: Record<string, (args: Args) => unknown> = {
  list_windows: () => windows,
  list_apps: () => apps,
  pinned_apps: () => apps.slice(0, 4),
  app_icon: () => null,
  list_monitors: () => [monitor],
  system_info: () => systemInfo,
  system_meters: () => meters,
  system_accent: () => "#0078d4",
  machine_name: () => "STUDIO",
  installed_terminals: () => ["wt", "pwsh", "powershell", "cmd"],
  media_status: () => media,
  audio_devices: () => audio,
  radios: () => radios,
  bluetooth_devices: () => ["WH-1000XM5"],
  input_language: () => input,
  notify_icons: () => trayIcons,
  notices_list: () => notices,
  notices_unseen: () => notices.length,
  clipboard_history: () => clips,
  clipboard_has_files: () => false,
  clipboard_read_files: () => null,
  create_folder: a => `${a.path}\\${a.name}`,
  rename_entry: a => {
    const path = String(a.path)

    return `${path.slice(0, path.lastIndexOf("\\") + 1)}${a.name}`
  },
  claude_usage: () => usage(),
  usage_bridge_installed: () => true,
  "plugin:eris-files|default_app_status": () => ({
    supported: true,
    enabled: false,
  }),
  screen_sharing: () => false,
  set_share_watch: () => undefined,
  usage_watch: () => undefined,
  set_window_region: () => undefined,
  p2p_status: () => p2p,
  p2p_invite: () => "STUDIO.CODE",
  p2p_sync: () => 0,
  note_linkable: () => true,
  note_preview: a =>
    `---
tags: [studio]
---
# ${a.path}

Agenda
- Review the dock growth option
- Check the notice anchor

Decisions go here.`,
}

export const silent = new Set([
  "activate_window",
  "close_window",
  "minimize_window",
  "preview_show",
  "preview_hide",
  "launch_app",
  "reorder_pins",
  "open_location",
  "clear_icon_cache",
  "clipboard_copy",
  "clipboard_paste",
  "clipboard_remove",
  "clipboard_pin",
  "clipboard_clear",
  "clipboard_write_files",
  "delete_entries",
  "transfer_entries",
  "apply_taskbar",
  "extend_taskbar",
  "apply_topbar",
  "extend_topbar",
  "release_topbar",
  "suspend_shell",
  "resume_shell",
  "set_win_key_capture",
  "set_launcher_shortcut",
  "set_features",
  "edit_mode",
  "edit_raise",
  "set_volume",
  "toggle_mute",
  "set_audio_device",
  "media_command",
  "spectrum_start",
  "spectrum_stop",
  "notices_seen",
  "notices_dismiss",
  "notify_icon_click",
  "notify_icon_promote",
  "set_radio",
  "quick_action",
  "cycle_input_language",
  "power_action",
  "empty_recycle_bin",
  "open_url",
  "run_command",
  "open_data_folder",
  "install_usage_bridge",
  "plugin:eris-files|new_window",
  "plugin:eris-files|open_default_apps",
  "p2p_join",
  "p2p_leave",
  "p2p_publish",
])
