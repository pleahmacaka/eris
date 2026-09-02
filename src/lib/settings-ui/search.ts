export type SectionId =
  | "general"
  | "dock"
  | "launcher"
  | "appearance"
  | "calendar"
  | "sync"
  | "advanced"
  | "about"

export type NavSection = {
  id: SectionId
  label: string
  icon: string
  blurb: string
}

export type SearchEntry = {
  section: SectionId
  label: string
  keywords: string
}

export const sections: NavSection[] = [
  {
    id: "general",
    label: "General",
    icon: "lucide:sliders-horizontal",
    blurb: "This device, startup, and the launcher hotkey",
  },
  {
    id: "dock",
    label: "Dock",
    icon: "lucide:panel-bottom",
    blurb: "The bar that replaces the Windows taskbar",
  },
  {
    id: "launcher",
    label: "Launcher",
    icon: "lucide:search",
    blurb: "Result groups and the web search engine",
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: "lucide:palette",
    blurb: "Presets, colors, and surfaces for every window",
  },
  {
    id: "calendar",
    label: "Calendar & todo",
    icon: "lucide:calendar-check",
    blurb: "Week layout, reminders, and list order",
  },
  {
    id: "sync",
    label: "Sync",
    icon: "lucide:refresh-cw",
    blurb: "Devices in step through your own server",
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: "lucide:wrench",
    blurb: "Stored data, caches, and resets",
  },
  {
    id: "about",
    label: "About",
    icon: "lucide:info",
    blurb: "Version and keyboard shortcuts",
  },
]

const entry = (
  section: SectionId,
  label: string,
  keywords = "",
): SearchEntry => ({ section, label, keywords })

export const index: SearchEntry[] = [
  entry("general", "Device name", "identity machine computer sync"),
  entry("general", "Start with Windows", "autostart startup boot sign in"),
  entry("general", "Hide Windows taskbar", "system bar edge"),
  entry("general", "Language", "english locale"),
  entry("general", "Setup wizard", "onboarding first run"),
  entry("general", "Open with", "hotkey trigger win key launcher"),
  entry("general", "Shortcut", "hotkey keybinding combination"),
  entry("general", "Backup", "export import json file restore"),
  entry("dock", "Style", "windows mac floating"),
  entry("dock", "Display", "monitor screen multiple external primary"),
  entry("dock", "Edge", "bottom top screen side"),
  entry("dock", "Alignment", "start center"),
  entry("dock", "Height", "size thickness"),
  entry("dock", "Width", "size mac"),
  entry("dock", "Icon size", "icons"),
  entry("dock", "Auto-hide", "reveal slide"),
  entry("dock", "Hide Windows taskbar", "system bar"),
  entry("dock", "Show running apps", "open windows"),
  entry("dock", "Show battery", "power laptop"),
  entry("dock", "Show volume", "audio sound"),
  entry("dock", "Show media controls", "music play pause track spotify"),
  entry("dock", "Show CPU and memory", "meters usage ram performance"),
  entry("dock", "Show network", "wifi ethernet adapter connection"),
  entry("dock", "24-hour clock", "time format"),
  entry("dock", "Show seconds", "clock time"),
  entry("launcher", "Results per group", "max count"),
  entry("launcher", "Open windows", "switch running"),
  entry("launcher", "Commands", "lock sleep recycle bin power"),
  entry("launcher", "Todos", "quick add task"),
  entry("launcher", "Calculator", "math expression"),
  entry("launcher", "Web search", "google duckduckgo bing naver engine"),
  entry("appearance", "Presets", "theme look aurora glass nord"),
  entry("appearance", "Mode", "dark light system theme"),
  entry("appearance", "Background", "aura glass solid surface"),
  entry("appearance", "Follow Windows accent", "accent color system"),
  entry("appearance", "Accent hue", "color"),
  entry("appearance", "Color spread", "hue accent"),
  entry("appearance", "Vividness", "saturation color"),
  entry("appearance", "Texture", "grain noise"),
  entry("appearance", "Corner radius", "rounded corners"),
  entry("appearance", "Blur", "frosted glass"),
  entry("appearance", "Font size", "text scale"),
  entry("appearance", "Window opacity", "transparency translucent alpha"),
  entry("appearance", "Dock opacity", "transparency translucent taskbar"),
  entry("appearance", "Density", "compact cozy spacing"),
  entry("appearance", "Motion", "animation reduced"),
  entry("calendar", "Week starts on", "monday sunday"),
  entry("calendar", "Week numbers", "grid"),
  entry("calendar", "Default reminder", "notification minutes alert"),
  entry("calendar", "Show completed", "done todo"),
  entry("calendar", "Sort by", "order manual due priority"),
  entry("sync", "Server URL", "address host endpoint"),
  entry("sync", "Token", "secret auth bearer"),
  entry("sync", "Enable sync", "background"),
  entry("sync", "Interval", "minutes frequency"),
  entry("sync", "Collections", "todos events presets profile"),
  entry("sync", "Replace local data with server", "reset pull danger"),
  entry("sync", "Reset collection on server", "danger wipe"),
  entry("sync", "Unlink this device", "disconnect forget danger"),
  entry("advanced", "Stored data", "counts todos events presets"),
  entry(
    "advanced",
    "Data folder",
    "open data folder explorer files storage appdata",
  ),
  entry("advanced", "Icon cache", "clear icons rebuild thumbnails"),
  entry("advanced", "Reset appearance", "theme default preset"),
  entry("advanced", "Reset all settings", "defaults factory wipe"),
  entry("about", "Version", "build release eris"),
  entry("about", "Keyboard shortcuts", "keys hotkeys launcher panel"),
]

const clean = (query: string) => query.trim().toLowerCase()

export const searchRows = (query: string) => {
  const text = clean(query)

  if (!text) {
    return []
  }

  return index.filter(e =>
    `${e.label} ${e.keywords}`.toLowerCase().includes(text),
  )
}

export const searchSections = (query: string) => {
  const text = clean(query)

  if (!text) {
    return sections
  }

  const hits = new Set(searchRows(text).map(e => e.section))

  return sections.filter(
    s => hits.has(s.id) || `${s.label} ${s.blurb}`.toLowerCase().includes(text),
  )
}
