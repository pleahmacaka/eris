import { baseName, sameLocation } from "../locations"
import type { ShellEntry } from "../native"
import { driveName, places } from "./places.svelte"
import { prefs, type SidebarSection } from "./prefs.svelte"

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  "home",
  "pinned",
  "folders",
  "drives",
  "network",
  "shared",
  "recycleBin",
]

export const sectionShown = (id: SidebarSection) =>
  !prefs.sidebar.hidden.includes(id)

export const toggleSection = (id: SidebarSection) => {
  const { hidden } = prefs.sidebar

  prefs.sidebar.hidden = hidden.includes(id)
    ? hidden.filter(entry => entry !== id)
    : [...hidden, id]
}

export const pathShown = (path: string) =>
  !prefs.sidebar.hiddenPaths.some(hidden => sameLocation(hidden, path))

export const hidePath = (path: string) => {
  if (pathShown(path)) {
    prefs.sidebar.hiddenPaths = [...prefs.sidebar.hiddenPaths, path]
  }
}

export const showPath = (path: string) => {
  prefs.sidebar.hiddenPaths = prefs.sidebar.hiddenPaths.filter(
    hidden => !sameLocation(hidden, path),
  )
}

export const isPinned = (path: string) =>
  places.pinned.some(pin => sameLocation(pin.path, path))

export const orderedPins = (pins: ShellEntry[]) => {
  const rank = (pin: ShellEntry) => {
    const at = prefs.sidebar.order.findIndex(path =>
      sameLocation(path, pin.path),
    )

    return at < 0 ? Number.POSITIVE_INFINITY : at
  }

  return pins.toSorted((a, b) => rank(a) - rank(b))
}

export const movePin = (paths: string[], from: number, to: number) => {
  const next = [...paths]
  const [moved] = next.splice(from, 1)

  next.splice(to > from ? to - 1 : to, 0, moved)
  prefs.sidebar.order = next
}

export const sidebarLabel = (
  path: string,
  translate: (key: string) => string,
) => {
  const known = places.known.find(entry => sameLocation(entry.path, path))
  const drive = places.drives.find(entry => sameLocation(entry.path, path))
  const place = places.network.find(entry => sameLocation(entry.path, path))

  if (known) {
    return translate(`explorer.places.${known.id}`)
  }

  if (drive) {
    return driveName(drive, translate)
  }

  return place?.name ?? baseName(path)
}
