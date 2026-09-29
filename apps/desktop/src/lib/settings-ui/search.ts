export type SectionId =
  | "general"
  | "appearance"
  | "calendar"
  | "sync"
  | "advanced"
  | "experimental"
  | "dock"
  | "launcher"

export type NavSection = {
  id: SectionId
  icon: string
  feature?: boolean
}

export type SearchEntry = {
  section: SectionId
  key: string
  keywords: string
}

export type Translate = (key: string) => string

export const sections: NavSection[] = [
  { id: "general", icon: "lucide:sliders-horizontal" },
  { id: "appearance", icon: "lucide:palette" },
  { id: "calendar", icon: "lucide:calendar-check" },
  { id: "sync", icon: "lucide:refresh-cw" },
  { id: "advanced", icon: "lucide:wrench" },
  { id: "experimental", icon: "lucide:flask-conical" },
  { id: "dock", icon: "lucide:panel-bottom", feature: true },
  { id: "launcher", icon: "lucide:search", feature: true },
]

const entry = (
  section: SectionId,
  row: string,
  keywords = "",
): SearchEntry => ({ section, key: `settings.rows.${row}`, keywords })

export const index: SearchEntry[] = [
  entry("general", "deviceName", "identity machine computer sync"),
  entry("general", "autostart", "autostart startup boot sign in"),

  entry("general", "language", "english korean japanese chinese locale"),
  entry("general", "setupWizard", "onboarding first run"),
  entry("general", "backup", "export import json file restore"),
  entry("dock", "featureDock", "feature enable disable"),
  entry("dock", "style", "windows mac floating"),
  entry("dock", "display", "monitor screen multiple external primary"),
  entry("dock", "edge", "bottom top screen side"),
  entry("dock", "alignment", "start center launcher middle"),
  entry("dock", "height", "size thickness"),
  entry("dock", "width", "size mac"),
  entry("dock", "iconSize", "icons"),
  entry("dock", "pinDesktop", "mac behind windows wallpaper layer"),
  entry("dock", "autoHide", "reveal slide"),
  entry("dock", "hideAnimation", "slide fade motion"),
  entry("dock", "hideTaskbar", "system bar"),
  entry("dock", "topBar", "menubar mac top info widgets clock tray split"),
  entry("dock", "panelPosition", "calendar notifications left center right"),
  entry("dock", "showLauncherButton", "sparkles win key hide"),
  entry("dock", "showRunningApps", "open windows"),
  entry("dock", "showBattery", "power laptop"),
  entry("dock", "showVolume", "audio sound"),
  entry("dock", "showMedia", "music play pause track spotify"),
  entry("dock", "mediaSide", "media widget position left right"),
  entry("dock", "spectrumStyle", "visualizer bands mirror wave dots"),
  entry("dock", "claudeUsageSide", "claude usage widget position left right"),
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
  entry("launcher", "featureLauncher", "feature enable disable"),
  entry("launcher", "openWith", "hotkey trigger win key launcher"),
  entry("launcher", "shortcut", "hotkey keybinding combination"),
  entry("launcher", "keyboardShortcuts", "keys hotkeys launcher panel"),
  entry("launcher", "resultsPerGroup", "max count"),
  entry("launcher", "openWindows", "switch running"),
  entry("launcher", "commands", "lock sleep recycle bin power"),
  entry("launcher", "todos", "quick add task"),
  entry("launcher", "calculator", "math expression"),
  entry("launcher", "webSearch", "google duckduckgo bing naver engine"),
  entry("launcher", "terminal", "cmd powershell pwsh wt console shell"),
  entry("appearance", "presets", "theme look arix aurora glass nord"),
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
  entry("dock", "dockSeparators", "divider line sections"),
  entry("dock", "clockAlign", "clock time date left center right"),
  entry("dock", "dockLayout", "widgets spacer gap compose assemble"),
  entry("experimental", "editMode", "edit layout customize experimental"),
  entry(
    "experimental",
    "studio",
    "debug studio developer preview sandbox apply ipc",
  ),
  entry("dock", "showTrayIcons", "notification area system tray icons"),
  entry("dock", "showClaudeUsage", "claude usage limit widget"),
  entry("dock", "claudeUsageStacked", "claude usage two lines compact"),
  entry("dock", "claudeBridge", "claude statusline bridge connect"),
  entry("dock", "usageSnapshot", "claude usage file source path"),
  entry("dock", "showSettingsButton", "gear settings menu quit"),
  entry("dock", "showKeymap", "keyboard hints shortcuts"),
  entry("dock", "showSpectrum", "visualizer audio bars media"),
  entry("appearance", "density", "compact cozy spacing"),
  entry("appearance", "motion", "animation reduced"),
  entry("calendar", "featureCalendar", "feature enable disable panel"),
  entry("calendar", "weekStartsOn", "monday sunday"),
  entry("calendar", "holidayRegion", "country holidays public region"),
  entry("calendar", "weekNumbers", "grid"),
  entry("calendar", "defaultReminder", "notification minutes alert"),
  entry("calendar", "showCompleted", "done todo"),
  entry("calendar", "sortBy", "order manual due priority"),
  entry("sync", "enableSync", "background"),
  entry("sync", "showSyncStatus", "dock dot indicator clock tray"),
  entry("sync", "interval", "minutes frequency"),
  entry("sync", "collections", "todos events presets profile"),
  entry("sync", "pairDevice", "pairing code invite peer"),
  entry("sync", "joinDevice", "pairing code connect peer"),
  entry("sync", "unlinkDevice", "disconnect leave unpair peer"),
  entry("advanced", "storedData", "counts todos events presets"),
  entry(
    "advanced",
    "dataFolder",
    "open data folder explorer files storage appdata",
  ),
  entry("advanced", "iconCache", "clear icons rebuild thumbnails"),
  entry("advanced", "resetAppearance", "theme default preset"),
  entry("advanced", "resetAll", "defaults factory wipe"),
  entry("advanced", "updates", "update installer version release"),
  entry("advanced", "version", "build release eris"),
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
