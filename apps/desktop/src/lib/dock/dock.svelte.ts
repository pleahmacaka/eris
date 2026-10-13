import { updateDevice } from "@eris/settings"
import { untrack } from "svelte"
import {
  type AppEntry,
  appIcon,
  listApps,
  onAppsChanged,
  onPinsChanged,
  pinnedApps,
} from "#lib/native/apps.js"
import {
  listWindows,
  onWindowsChanged,
  type WindowEntry,
} from "#lib/native/windows.js"
import { fallbackPin, matchPin, windowIdentity } from "./identity"

export type DockPin = "windows" | "device" | null

export type DockGroup = {
  key: string
  name: string
  path: string
  pinned: DockPin
  windows: WindowEntry[]
}

const WINDOWS_POLL = 30_000

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
      byPath.get(path) ?? fallbackPin(path, displayName(baseName(path))),
  )
}

export const toggleDockHidden = (path: string) =>
  updateDevice(device => ({
    ...device,
    hiddenApps: device.hiddenApps.includes(path)
      ? device.hiddenApps.filter(p => p !== path)
      : [...device.hiddenApps, path],
  }))

export const toggleDockPin = (path: string) =>
  updateDevice(device => ({
    ...device,
    pinnedApps: device.pinnedApps.includes(path)
      ? device.pinnedApps.filter(p => p !== path)
      : [...device.pinnedApps, path],
  }))

export const groupWindows = (
  pinned: AppEntry[],
  devicePinned: AppEntry[],
  windows: WindowEntry[],
): DockGroup[] => {
  const groups: DockGroup[] = []
  const seen = new Set<string>()
  const byExe = new Map<string, DockGroup>()
  const pinGroups: { app: AppEntry; group: DockGroup }[] = []

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
    seen.add(path)
    groups.push(group)
    pinGroups.push({ app, group })
  }

  for (const app of pinned) {
    pin(app, "windows")
  }

  for (const app of devicePinned) {
    pin(app, "device")
  }

  for (const entry of windows) {
    const exe = windowIdentity(entry)
    let score = 0
    let group: DockGroup | undefined
    for (const candidate of pinGroups) {
      const match = matchPin(candidate.app, entry)
      if (match > score) {
        score = match
        group = candidate.group
      }
    }
    group ??= byExe.get(exe)

    if (!group) {
      group = {
        key: exe,
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

class DockState {
  pinned = $state.raw<AppEntry[]>([])

  apps = $state.raw<AppEntry[]>([])

  windows = $state.raw<WindowEntry[]>([])
}

export const dock = new DockState()

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

let refreshing: Promise<void> | undefined
let again = false

const readWindows = async () => {
  do {
    again = false

    const next = await listWindows().catch(() => [])

    if (!same(next, dock.windows)) {
      dock.windows = next
    }
  } while (again)
}

export const refreshDock = () => {
  if (!dockAwake.visible) {
    return Promise.resolve()
  }

  if (refreshing) {
    again = true

    return refreshing
  }

  refreshing = readWindows().finally(() => {
    refreshing = undefined
  })

  return refreshing
}

export const startDock = () => {
  const refresh = refreshDock

  const refreshPins = () =>
    pinnedApps()
      .then(list => {
        if (!same(list, dock.pinned)) {
          dock.pinned = list
        }
      })
      .catch(() => undefined)

  const refreshApps = () =>
    listApps()
      .then(list => {
        dock.apps = list
      })
      .catch(() => undefined)

  refreshPins()
  refreshApps()

  const timer = setInterval(refresh, WINDOWS_POLL)
  const stopWake = $effect.root(() => {
    $effect(() => {
      if (dockAwake.visible) {
        untrack(refresh)
      }
    })
  })
  const stops = [
    onWindowsChanged(() => void refresh()),
    onAppsChanged(() => void refreshApps()),
    onPinsChanged(() => void refreshPins()),
  ]

  return () => {
    clearInterval(timer)
    stopWake()

    for (const stop of stops) {
      stop.then(off => off()).catch(() => undefined)
    }
  }
}
