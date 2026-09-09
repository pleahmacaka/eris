export type SectionId =
  | "general"
  | "dock"
  | "launcher"
  | "appearance"
  | "calendar"
  | "sync"
  | "advanced"
  | "keymap"
  | "about"

export type NavSection = {
  id: SectionId
  icon: string
}

export type SearchEntry = {
  section: SectionId
  key: string
  keywords: string
}

export type Translate = (key: string) => string

export const sections: NavSection[] = [
  { id: "general", icon: "lucide:sliders-horizontal" },
  { id: "dock", icon: "lucide:panel-bottom" },
  { id: "launcher", icon: "lucide:search" },
  { id: "appearance", icon: "lucide:palette" },
  { id: "calendar", icon: "lucide:calendar-check" },
  { id: "sync", icon: "lucide:refresh-cw" },
  { id: "advanced", icon: "lucide:wrench" },
  { id: "keymap", icon: "lucide:keyboard" },
  { id: "about", icon: "lucide:info" },
]

const entry = (
  section: SectionId,
  row: string,
  keywords = "",
): SearchEntry => ({ section, key: `settings.rows.${row}`, keywords })

export const index: SearchEntry[] = [
  entry("general", "deviceName", "identity machine computer sync"),
  entry("general", "autostart", "autostart startup boot sign in"),
  entry("general", "hideTaskbar", "system bar edge"),
  entry("general", "language", "english korean japanese chinese locale"),
  entry("general", "featureDock", "feature enable disable"),
  entry("general", "featureLauncher", "feature enable disable"),
  entry("general", "featureChat", "feature enable disable claude"),
  entry("general", "snapDistance", "chat bubble edge percent"),
  entry("general", "chatModel", "chat claude code model opus sonnet haiku"),
  entry("general", "chatEffort", "chat claude code effort thinking level"),
  entry(
    "general",
    "chatPermission",
    "chat claude code permission mode bypass plan",
  ),
  entry("general", "chatThinking", "chat claude code extended thinking"),
  entry("general", "chatAutoCompact", "chat claude code context compact"),
  entry("general", "chatLanguage", "chat claude code response language"),
  entry("general", "chatBudget", "chat claude code cost limit usd"),
  entry(
    "general",
    "chatSystemPrompt",
    "chat claude code system prompt instructions",
  ),
  entry("general", "chatHover", "chat bubble tooltip title preview"),
  entry("general", "chatMultiBubble", "chat bubbles sessions plus stack"),
  entry("general", "chatBubbleColors", "chat bubble ring hue color"),
  entry("general", "chatQueueMode", "chat queue message after tool reply"),
  entry("general", "setupWizard", "onboarding first run"),
  entry("general", "openWith", "hotkey trigger win key launcher"),
  entry("general", "shortcut", "hotkey keybinding combination"),
  entry("general", "backup", "export import json file restore"),
  entry("dock", "style", "windows mac floating"),
  entry("dock", "display", "monitor screen multiple external primary"),
  entry("dock", "edge", "bottom top screen side"),
  entry("dock", "alignment", "start center uchiwa fan launcher middle"),
  entry("dock", "height", "size thickness"),
  entry("dock", "width", "size mac"),
  entry("dock", "iconSize", "icons"),
  entry("dock", "pinDesktop", "mac behind windows wallpaper layer"),
  entry("dock", "autoHide", "reveal slide"),
  entry("dock", "hideTaskbar", "system bar"),
  entry("dock", "showLauncherButton", "sparkles win key hide"),
  entry("dock", "showRunningApps", "open windows"),
  entry("dock", "showBattery", "power laptop"),
  entry("dock", "showVolume", "audio sound"),
  entry("dock", "showMedia", "music play pause track spotify"),
  entry("dock", "showMeters", "meters usage ram performance cpu memory"),
  entry("dock", "showNetwork", "wifi ethernet adapter connection"),
  entry("dock", "showBluetooth", "bluetooth radio devices headset pair"),
  entry(
    "dock",
    "showNotifications",
    "bell notification center action quick settings focus",
  ),
  entry("dock", "showDesktopButton", "show desktop peek minimize strip"),
  entry("dock", "showTaskView", "task view timeline windows overview"),
  entry(
    "dock",
    "showInputLanguage",
    "keyboard layout ime language korean english indicator",
  ),
  entry("dock", "clock24h", "time format 24-hour"),
  entry("dock", "showSeconds", "clock time"),
  entry("launcher", "resultsPerGroup", "max count"),
  entry("launcher", "openWindows", "switch running"),
  entry("launcher", "commands", "lock sleep recycle bin power"),
  entry("launcher", "todos", "quick add task"),
  entry("launcher", "calculator", "math expression"),
  entry("launcher", "webSearch", "google duckduckgo bing naver engine"),
  entry("appearance", "presets", "theme look aurora glass nord"),
  entry("appearance", "mode", "dark light system theme"),
  entry("appearance", "background", "aura glass solid surface"),
  entry("appearance", "followAccent", "accent color system"),
  entry("appearance", "accentHue", "color"),
  entry("appearance", "colorSpread", "hue accent"),
  entry("appearance", "vividness", "saturation color"),
  entry("appearance", "texture", "grain noise"),
  entry("appearance", "cornerRadius", "rounded corners"),
  entry("appearance", "blur", "frosted glass"),
  entry("appearance", "fontSize", "text scale"),
  entry("appearance", "windowOpacity", "transparency translucent alpha"),
  entry("appearance", "dockOpacity", "transparency translucent taskbar"),
  entry("appearance", "dockBackground", "dock aura glass solid taskbar"),
  entry("appearance", "dockBlur", "dock blur frosted taskbar"),
  entry("appearance", "dockRadius", "dock corners rounded taskbar"),
  entry("appearance", "dockTint", "dock accent color taskbar"),
  entry("appearance", "dockBorder", "dock border outline taskbar"),
  entry("appearance", "dockAura", "dock orbs animation taskbar"),
  entry("dock", "dockSeparators", "divider line sections"),
  entry("dock", "clockAlign", "clock time date left center right"),
  entry("dock", "editMode", "edit layout customize experimental"),
  entry("appearance", "density", "compact cozy spacing"),
  entry("appearance", "motion", "animation reduced"),
  entry("calendar", "weekStartsOn", "monday sunday"),
  entry("calendar", "weekNumbers", "grid"),
  entry("calendar", "defaultReminder", "notification minutes alert"),
  entry("calendar", "showCompleted", "done todo"),
  entry("calendar", "sortBy", "order manual due priority"),
  entry("sync", "serverUrl", "address host endpoint"),
  entry("sync", "token", "secret auth bearer"),
  entry("sync", "enableSync", "background"),
  entry("sync", "interval", "minutes frequency"),
  entry("sync", "collections", "todos events presets profile"),
  entry("sync", "replaceLocal", "reset pull danger"),
  entry("sync", "resetCollection", "danger wipe"),
  entry("sync", "unlinkDevice", "disconnect forget danger"),
  entry("advanced", "storedData", "counts todos events presets"),
  entry(
    "advanced",
    "dataFolder",
    "open data folder explorer files storage appdata",
  ),
  entry("advanced", "iconCache", "clear icons rebuild thumbnails"),
  entry("advanced", "resetAppearance", "theme default preset"),
  entry("advanced", "resetAll", "defaults factory wipe"),
  entry("keymap", "chatShortcut", "claude bubble hotkey ctrl space"),
  entry("about", "updates", "update installer version release"),
  entry("about", "version", "build release eris"),
  entry("keymap", "keyboardShortcuts", "keys hotkeys launcher panel"),
]

const clean = (query: string) => query.trim().toLowerCase()

export const searchRows = (query: string, t: Translate) => {
  const text = clean(query)

  if (!text) {
    return []
  }

  return index.filter(e =>
    `${t(e.key)} ${e.keywords}`.toLowerCase().includes(text),
  )
}

export const searchSections = (query: string, t: Translate) => {
  const text = clean(query)

  if (!text) {
    return sections
  }

  const hits = new Set(searchRows(text, t).map(e => e.section))

  return sections.filter(
    s =>
      hits.has(s.id) ||
      `${t(`settings.sections.${s.id}.label`)} ${t(`settings.sections.${s.id}.blurb`)}`
        .toLowerCase()
        .includes(text),
  )
}
