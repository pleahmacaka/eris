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
} from "#lib/native/index.js"

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
  cpu: 0.18,
  memory: 0.54,
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

const p2p: P2pStatus = {
  nodeId: "studio",
  paired: false,
  peers: [],
  removable: [],
}

const HOME_DIR = "C:\\Users\\Studio"

const known = ["desktop", "downloads", "documents", "pictures", "music"].map(
  id => ({ id, path: `${HOME_DIR}\\${id[0].toUpperCase()}${id.slice(1)}` }),
)

const entry = (name: string, dir: boolean, size: number, minutes: number) => ({
  name,
  dir,
  size,
  modified: ago(minutes),
  created: ago(minutes),
  attrs: dir ? 16 : 32,
  link: false,
})

const paths = (args: Args) =>
  Array.isArray(args.paths) ? args.paths.map(String) : []

const folderEntries = [
  entry("Projects", true, 0, 40),
  entry("Screenshots", true, 0, 300),
  entry("eris-0.3.3-setup.exe", false, 18_944_000, 90),
  entry("notes.md", false, 4_200, 15),
  entry("notes copy.md", false, 4_200, 12),
  entry("README.md", false, 1_800, 30),
  { ...entry("shared", true, 0, 50), link: true },
  entry(".gitignore", false, 120, 30),
  entry("wallpaper.png", false, 2_480_000, 2 * 60 * 24),
  entry("budget.csv", false, 12_800, 3 * 60 * 24),
]

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
  dock_maximized: () => false,
  note_status: () => ({ installed: true, vault: null, linked: false }),
  note_pages: ({ query }) =>
    [
      { title: "회의록", path: "회의록.md" },
      { title: "계획", path: "프로젝트/계획.md" },
    ].filter(page => page.title.includes(String(query ?? ""))),
  note_bridge_read: () => null,
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
  "plugin:eris-terminal|shells": () => [
    { id: "pwsh", name: "PowerShell" },
    { id: "cmd", name: "Command Prompt" },
  ],
  window_ready: () => null,
  "plugin:eris-terminal|take_intent": () => ({ cwd: null, handoff: null }),
  "plugin:eris-terminal|spawn": () => Math.floor(Math.random() * 1e9),
  "plugin:eris-terminal|attach": () => new ArrayBuffer(0),
  "plugin:eris-terminal|detach": () => null,
  "plugin:eris-terminal|write": () => null,
  "plugin:eris-terminal|resize": () => null,
  "plugin:eris-terminal|kill": () => null,
  "plugin:eris-files|take_intent": () => ({ path: null, select: null }),
  "plugin:eris-files|known_folders": () => [
    { id: "home", path: HOME_DIR },
    ...known,
  ],
  "plugin:eris-files|drives": () => [
    {
      path: "C:\\",
      label: "",
      kind: "fixed",
      free: 412_000_000_000,
      total: 1_000_000_000_000,
      remote: "",
      connected: true,
    },
  ],
  "plugin:eris-files|network_places": () => [],
  "plugin:eris-files|wsl_distros": () => [],
  "plugin:eris-files|explorer_settings": () => ({
    showHidden: false,
    showExtensions: true,
  }),
  "plugin:eris-files|list_shell": a => ({
    path: String(a.path),
    name: "Home",
    entries: known.map(folder => ({
      key: folder.path,
      path: folder.path,
      name: folder.path.slice(folder.path.lastIndexOf("\\") + 1),
      dir: true,
      size: 0,
      modified: ago(60),
      kind: "File folder",
    })),
  }),
  "plugin:eris-files|share_state": () => ({
    name: "Studio",
    devices: [],
    shares: [],
    inbox: [],
    pendingPair: null,
    syncs: [],
    syncInvites: [],
    senior: false,
    browse: { scope: "drives", folders: [], always: [] },
    browseAsks: [],
    members: [],
  }),
  "plugin:eris-files|share_take_attention": () => false,
  "plugin:eris-files|bandizip_available": () => false,
  "plugin:eris-files|list_dir": a => ({
    path: String(a.path),
    entries: folderEntries,
    types: {
      "/": "File folder",
      ".exe": "Application",
      ".md": "Markdown File",
      ".png": "PNG File",
      ".csv": "CSV File",
    },
  }),
  "plugin:eris-files|identical_files": a => a.groups,
  "plugin:eris-files|probe_dirs": a => ({
    empty: paths(a).filter(path => path.endsWith("Screenshots")),
    repos: paths(a).filter(path => path.endsWith("Projects")),
    submodules: [],
  }),
  "plugin:eris-files|installers": a =>
    paths(a).filter(path => path.includes("setup")),
  "plugin:eris-files|preview_text": () =>
    "# Studio\n\nSample **README** with a [link](https://example.com).\n\n- one\n- two\n",
  "plugin:eris-files|git_repo": a => ({
    root: String(a.path),
    prefix: "",
    superproject: null,
  }),
  "plugin:eris-files|git_status": a => ({
    root: String(a.path),
    prefix: "",
    superproject: null,
    branch: "main",
    upstream: "origin/main",
    ahead: 1,
    behind: 0,
    changes: [
      { code: " M", path: "notes.md" },
      { code: "A ", path: "budget.csv" },
      { code: "??", path: "wallpaper.png" },
      { code: "!!", path: "Screenshots/" },
      { code: " M", path: "Projects/app/main.rs" },
    ],
  }),
  "plugin:eris-files|git_log": () => [
    {
      hash: "61c4c16",
      subject: "chore(main): release 0.3.12",
      author: "Studio",
      time: ago(90),
    },
    {
      hash: "039a619",
      subject: "fix(tray): reset callback negotiation",
      author: "Studio",
      time: ago(600),
    },
  ],
  "plugin:eris-files|git_stage": () => null,
  "plugin:eris-files|git_unstage": () => null,
  "plugin:eris-files|git_commit": () => null,
  "plugin:eris-files|git_sync": () => null,
  "plugin:eris-files|git_clone": a => `${String(a.parent)}\\${String(a.name)}`,
  "plugin:eris-files|cleanup_plan": () => null,
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
  "take_theme_link",
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
  "note_bridge_publish",
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
  "plugin:eris-files|watch_dir",
  "plugin:eris-files|open_default_apps",
  "p2p_join",
  "p2p_leave",
  "p2p_publish",
  "p2p_remove",
])
