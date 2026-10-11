import {
  DOCK_ALIGNS,
  DOCK_STYLES,
  defaultAppearance,
  defaultDevice,
  defaultProfile,
  defaultSync,
  presetAppearances,
  WINDOW_BACKGROUNDS,
} from "./defaults"
import type {
  Appearance,
  DeviceSettings,
  DockAlign,
  DockWidget,
  DockWidgetKind,
  ErisStyle,
  Features,
  Profile,
  ThemePrefs,
} from "./model"

const WINDOW_KEYS: string[] = Object.values(WINDOW_BACKGROUNDS)

const dockLook = (appearance?: Partial<Appearance>) =>
  Object.fromEntries(
    Object.entries(appearance ?? {}).filter(
      ([key]) => key.startsWith("dock") || WINDOW_KEYS.includes(key),
    ),
  )

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

// Kept internal to the package facade: persistence supplies the saved value.
export const withDeviceDefaults = (
  saved?: Partial<DeviceSettings> | null,
): DeviceSettings => {
  const { chat, ...features } = (saved?.features ?? {}) as Partial<Features> & {
    chat?: boolean
  }
  const unknownDock =
    !DOCK_STYLES.includes(saved?.dockStyle ?? defaultDevice.dockStyle) ||
    !DOCK_ALIGNS.includes(saved?.dockAlign ?? defaultDevice.dockAlign)
  const migrated = {
    ...(unknownDock
      ? { dockStyle: defaultDevice.dockStyle, dockAlign: "center" as DockAlign }
      : {}),
    ...(chat === false ? { showClaudeUsage: false } : {}),
  }

  return {
    ...defaultDevice,
    ...saved,
    ...migrated,
    dockWidgets: sanitizeWidgets(saved?.dockWidgets),
    features: { ...defaultDevice.features, ...features },
    sync: {
      enabled: saved?.sync?.enabled ?? defaultSync.enabled,
      intervalMinutes:
        saved?.sync?.intervalMinutes ?? defaultSync.intervalMinutes,
      collections: { ...defaultSync.collections, ...saved?.sync?.collections },
    },
    note: { ...defaultDevice.note, ...saved?.note },
  }
}

export const withProfileDefaults = (
  saved?: Partial<Profile> | null,
): Profile => ({
  ...defaultProfile,
  ...saved,
  // an untouched built-in preset tracks its current values, so preset updates reach existing profiles
  appearance:
    saved?.presetId && presetAppearances[saved.presetId]
      ? {
          ...presetAppearances[saved.presetId],
          ...dockLook(saved.appearance),
        }
      : { ...defaultAppearance, ...saved?.appearance },
  launcher: { ...defaultProfile.launcher, ...saved?.launcher },
  calendar: { ...defaultProfile.calendar, ...saved?.calendar },
  todo: { ...defaultProfile.todo, ...saved?.todo },
})

export const standaloneAppearance = (
  style: ErisStyle,
  prefs: ThemePrefs,
): Appearance =>
  style.linked && prefs.followEris
    ? withProfileDefaults(style.profile).appearance
    : { ...defaultAppearance, mode: prefs.mode, ...prefs.look }
