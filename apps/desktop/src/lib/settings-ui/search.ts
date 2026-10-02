export type SectionId =
  | "general"
  | "appearance"
  | "dock"
  | "tray"
  | "launcher"
  | "calendar"
  | "sync"
  | "data"
  | "about"
  | "experimental"

export type NavGroup = "base" | "features" | "system"

export type NavSection = {
  id: SectionId
  icon: string
  group: NavGroup
}

export type SearchEntry = {
  section: SectionId
  key: string
  keywords: string
}

export type Translate = (key: string) => string

export const sections: NavSection[] = [
  { id: "general", icon: "lucide:sliders-horizontal", group: "base" },
  { id: "appearance", icon: "lucide:palette", group: "base" },
  { id: "dock", icon: "lucide:panel-bottom", group: "features" },
  { id: "tray", icon: "lucide:blocks", group: "features" },
  { id: "launcher", icon: "lucide:search", group: "features" },
  { id: "calendar", icon: "lucide:calendar-check", group: "features" },
  { id: "sync", icon: "lucide:refresh-cw", group: "system" },
  { id: "data", icon: "lucide:database", group: "system" },
  { id: "about", icon: "lucide:info", group: "system" },
  { id: "experimental", icon: "lucide:flask-conical", group: "system" },
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
  entry("general", "erisFiles", "explorer files folder browser"),
  entry(
    "general",
    "filesDefault",
    "explorer file manager default win+e folder",
  ),

  entry("appearance", "presets", "theme look arix aurora glass nord"),
  entry("appearance", "mode", "dark light system theme"),
  entry("appearance", "followAccent", "accent color system"),
  entry("appearance", "accentHue", "color"),
  entry("appearance", "colorSpread", "hue accent"),
  entry("appearance", "vividness", "saturation color"),
  entry("appearance", "background", "aura glass solid surface"),
  entry("appearance", "windowOpacity", "transparency translucent alpha"),
  entry("appearance", "blur", "frosted glass"),
  entry("appearance", "texture", "grain noise"),
  entry("appearance", "cornerRadius", "rounded corners"),
  entry("appearance", "fontSize", "text scale"),
  entry("appearance", "density", "compact cozy spacing"),
  entry("appearance", "motion", "animation reduced"),

  entry("dock", "featureDock", "feature enable disable"),
  entry("dock", "style", "windows mac floating"),
  entry("dock", "edge", "bottom top screen side"),
  entry("dock", "display", "monitor screen multiple external primary"),
  entry("dock", "alignment", "start center launcher middle"),
  entry("dock", "dockIslands", "island pill split separate rounded widgets"),
  entry("dock", "islandGap", "island gap spacing distance between"),
  entry("dock", "dockIcon", "icon logo custom image launcher button"),
  entry("dock", "height", "size thickness"),
  entry("dock", "width", "size mac"),
  entry("dock", "dockGrowth", "grow wider overflow more apps windows mac"),
  entry("dock", "iconSize", "icons"),
  entry("dock", "autoHide", "reveal slide"),
  entry("dock", "hideDelay", "delay speed fast slow timeout"),
  entry("dock", "hideAnimation", "slide fade motion"),
  entry("dock", "hideGather", "gather logo pill shrink motion"),
  entry("dock", "gatherHideMs", "duration speed gather logo hide animation"),
  entry("dock", "gatherShowMs", "duration speed unfold reveal show animation"),
  entry("dock", "pinDesktop", "mac behind windows wallpaper layer"),
  entry("dock", "hideTaskbar", "system bar"),
  entry("dock", "showRunningApps", "open windows"),
  entry("dock", "topBar", "menubar mac top info widgets clock tray split"),
  entry("dock", "panelPosition", "calendar notifications left center right"),
  entry("dock", "dockSeparators", "divider line sections"),
  entry("dock", "showLauncherButton", "sparkles win key hide"),
  entry("dock", "dockLayout", "widgets spacer gap compose assemble"),
  entry("dock", "dockBackground", "dock aura glass solid taskbar"),
  entry("dock", "dockOpacity", "transparency translucent taskbar"),
  entry("dock", "dockBlur", "dock blur frosted taskbar"),
  entry("dock", "dockRadius", "dock corners rounded taskbar"),
  entry("dock", "dockTint", "dock accent color taskbar"),
  entry("dock", "dockBorder", "dock border outline taskbar"),

  entry("tray", "showTrayIcons", "notification area system tray icons"),
  entry("tray", "showVolume", "audio sound"),
  entry("tray", "showBattery", "power laptop"),
  entry("tray", "showMeters", "meters usage ram performance cpu memory"),
  entry("tray", "showNetwork", "wifi ethernet adapter connection"),
  entry("tray", "showBluetooth", "bluetooth radio devices headset pair"),
  entry(
    "tray",
    "showInputLanguage",
    "keyboard layout ime language korean english indicator",
  ),
  entry(
    "tray",
    "showNotifications",
    "bell notification center action quick settings focus",
  ),
  entry("tray", "showTaskView", "task view timeline windows overview"),
  entry("tray", "showDesktopButton", "show desktop peek minimize strip"),
  entry("tray", "showSettingsButton", "gear settings menu quit"),
  entry("tray", "clock24h", "time format 24-hour"),
  entry("tray", "showSeconds", "clock time"),
  entry("tray", "clockAlign", "clock time date left center right"),
  entry("tray", "showMedia", "music play pause track spotify"),
  entry("tray", "mediaSide", "media widget position left right"),
  entry("tray", "showSpectrum", "visualizer audio bars media"),
  entry("tray", "spectrumStyle", "visualizer bands mirror wave dots"),
  entry("tray", "showClaudeUsage", "claude usage limit widget"),
  entry("tray", "claudeUsageSide", "claude usage widget position left right"),
  entry("tray", "claudeUsageStacked", "claude usage two lines compact"),
  entry("tray", "claudeBridge", "claude statusline bridge connect"),
  entry("tray", "usageSnapshot", "claude usage file source path"),

  entry("launcher", "featureLauncher", "feature enable disable"),
  entry("launcher", "openWith", "hotkey trigger win key launcher"),
  entry("launcher", "shortcut", "hotkey keybinding combination"),
  entry("launcher", "resultsPerGroup", "max count"),
  entry("launcher", "showKeymap", "keyboard hints shortcuts"),
  entry("launcher", "openWindows", "switch running"),
  entry("launcher", "commands", "lock sleep recycle bin power"),
  entry("launcher", "todos", "quick add task"),
  entry("launcher", "calculator", "math expression"),
  entry("launcher", "webSearch", "google duckduckgo bing naver engine"),
  entry("launcher", "terminal", "cmd powershell pwsh wt console shell"),
  entry("launcher", "keyboardShortcuts", "keys hotkeys launcher panel"),

  entry("calendar", "featureCalendar", "feature enable disable panel"),
  entry("calendar", "weekStartsOn", "monday sunday"),
  entry("calendar", "holidayRegion", "country holidays public region"),
  entry("calendar", "weekNumbers", "grid"),
  entry("calendar", "defaultReminder", "notification minutes alert"),
  entry(
    "calendar",
    "eventTags",
    "tags labels work personal private screen share",
  ),
  entry("calendar", "showCompleted", "done todo"),
  entry("calendar", "sortBy", "order manual due priority"),

  entry("sync", "enableSync", "background"),
  entry("sync", "showSyncStatus", "dock dot indicator clock tray"),
  entry("sync", "interval", "minutes frequency"),
  entry("sync", "collections", "todos events presets profile"),
  entry("sync", "pairDevice", "pairing code invite peer"),
  entry("sync", "joinDevice", "pairing code connect peer"),
  entry("sync", "unlinkDevice", "disconnect leave unpair peer"),

  entry("data", "backup", "export import json file restore"),
  entry("data", "storedData", "counts todos events presets"),
  entry(
    "data",
    "dataFolder",
    "open data folder explorer files storage appdata",
  ),
  entry("data", "iconCache", "clear icons rebuild thumbnails"),
  entry("data", "resetAppearance", "theme default preset"),
  entry("data", "resetAll", "defaults factory wipe"),

  entry("about", "version", "build release eris"),
  entry("about", "updates", "update installer version release"),

  entry("experimental", "editMode", "edit layout customize experimental"),
  entry(
    "experimental",
    "studio",
    "debug studio developer preview sandbox apply ipc",
  ),
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
