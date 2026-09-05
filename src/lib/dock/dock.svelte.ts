import {
  type AppEntry,
  appIcon,
  listApps,
  listWindows,
  pinnedApps,
  type WindowEntry,
} from "$lib/native"
import { loadDevice, saveDevice } from "$lib/settings"

export type DockPin = "windows" | "device" | null

export type DockGroup = {
  key: string
  name: string
  path: string
  pinned: DockPin
  windows: WindowEntry[]
}

const WINDOWS_POLL = 1_500

const icons = new Map<string, Promise<string | null>>()

export const iconFor = (path: string) => {
  let pending = icons.get(path)

  if (!pending) {
    pending = appIcon(path).catch(() => null)
    icons.set(path, pending)
  }

  return pending
}

const baseName = (path: string) => path.slice(path.lastIndexOf("\\") + 1)

const displayName = (file: string) => {
  const dot = file.lastIndexOf(".")
  const stem = dot > 0 ? file.slice(0, dot) : file

  return stem.charAt(0).toUpperCase() + stem.slice(1)
}

export const resolvePins = (paths: string[], apps: AppEntry[]): AppEntry[] => {
  const byPath = new Map(apps.map(a => [a.path, a]))

  return paths.map(
    (path): AppEntry =>
      byPath.get(path) ?? {
        id: path,
        name: displayName(baseName(path)),
        path,
        kind: "shortcut",
        subtitle: "",
      },
  )
}

export const toggleDockHidden = async (path: string) => {
  const device = await loadDevice()
  const hiddenApps = device.hiddenApps.includes(path)
    ? device.hiddenApps.filter(p => p !== path)
    : [...device.hiddenApps, path]

  await saveDevice({ ...device, hiddenApps })
}

export const toggleDockPin = async (path: string) => {
  const device = await loadDevice()
  const pinnedApps = device.pinnedApps.includes(path)
    ? device.pinnedApps.filter(p => p !== path)
    : [...device.pinnedApps, path]

  await saveDevice({ ...device, pinnedApps })
}

export const groupWindows = (
  pinned: AppEntry[],
  devicePinned: AppEntry[],
  windows: WindowEntry[],
): DockGroup[] => {
  const groups: DockGroup[] = []
  const seen = new Set<string>()
  const byExe = new Map<string, DockGroup>()

  const pin = (app: AppEntry, source: DockPin) => {
    const path = app.path.toLowerCase()

    if (seen.has(path)) {
      return
    }

    const group: DockGroup = {
      key: app.path,
      name: app.name,
      path: app.path,
      pinned: source,
      windows: [],
    }
    const exe = (app.subtitle || baseName(app.path)).toLowerCase()

    seen.add(path)
    groups.push(group)

    if (exe.endsWith(".exe") && !byExe.has(exe)) {
      byExe.set(exe, group)
    }
  }

  for (const app of pinned) {
    pin(app, "windows")
  }

  for (const app of devicePinned) {
    pin(app, "device")
  }

  for (const entry of windows) {
    const exe = baseName(entry.process).toLowerCase()
    let group = byExe.get(exe)

    if (!group) {
      group = {
        key: entry.process.toLowerCase(),
        name: displayName(baseName(entry.process)),
        path: entry.process,
        pinned: null,
        windows: [],
      }
      byExe.set(exe, group)
      groups.push(group)
    }

    group.windows.push(entry)
  }

  return groups
}

export const dockAwake = $state({ visible: true })

export const dock = $state<{
  pinned: AppEntry[]
  apps: AppEntry[]
  windows: WindowEntry[]
}>({
  pinned: [],
  apps: [],
  windows: [],
})

export const startDock = () => {
  const refresh = async () => {
    if (!dockAwake.visible) {
      return
    }

    dock.windows = await listWindows().catch(() => [])
  }

  pinnedApps()
    .then(list => {
      dock.pinned = list
    })
    .catch(() => undefined)
  listApps()
    .then(list => {
      dock.apps = list
    })
    .catch(() => undefined)
  refresh()

  const timer = setInterval(refresh, WINDOWS_POLL)

  return () => clearInterval(timer)
}
