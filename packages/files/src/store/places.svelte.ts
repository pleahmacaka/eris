import { tr } from "@eris/i18n"
import {
  HOME,
  isDriveRoot,
  RECYCLE_BIN,
  SHARED,
  sameLocation,
  THIS_PC,
} from "../locations"
import {
  type Drive,
  drives,
  type Known,
  knownFolders,
  listShell,
  type NetworkPlace,
  networkPlaces,
  type ShellEntry,
  wslDistros,
} from "../native"
import { prefs } from "./prefs.svelte"

export const places = $state<{
  known: Known[]
  drives: Drive[]
  pinned: ShellEntry[]
  network: NetworkPlace[]
  linux: NetworkPlace[]
}>({ known: [], drives: [], pinned: [], network: [], linux: [] })

const shareName = (remote: string) => {
  const parts = remote.split("\\").filter(Boolean)

  return parts.length > 1
    ? `${parts.at(-1)} (\\\\${parts.slice(0, -1).join("\\")})`
    : remote
}

const systemLabel = (drive: Drive, translate: (key: string) => string) => {
  const kind = drive.kind === "fixed" ? "local" : drive.kind

  return (
    (drive.remote && shareName(drive.remote)) ||
    drive.label ||
    translate(`explorer.drive.${kind}`)
  )
}

export const driveLabel = (drive: Drive, translate: (key: string) => string) =>
  prefs.driveNames[drive.path] || systemLabel(drive, translate)

export const driveName = (drive: Drive, translate: (key: string) => string) =>
  `${driveLabel(drive, translate)} (${drive.path.slice(0, 2)})`

export const nameDrive = (drive: Drive, name: string) => {
  const alias = name.trim()
  const others = Object.entries(prefs.driveNames).filter(
    ([path]) => path !== drive.path,
  )
  const custom = alias && alias !== systemLabel(drive, tr)

  prefs.driveNames = Object.fromEntries(
    custom ? [...others, [drive.path, alias]] : others,
  )
}

export const NAMED_PLACES: [string, string][] = [
  [HOME, "explorer.places.home"],
  [THIS_PC, "explorer.places.thisPc"],
  [RECYCLE_BIN, "explorer.places.recycleBin"],
  [SHARED, "explorer.places.shared"],
]

export const placeName = (
  location: string,
  translate: (key: string) => string,
) => {
  const named = NAMED_PLACES.find(([path]) => path === location)

  if (named) {
    return translate(named[1])
  }

  const drive = isDriveRoot(location)
    ? places.drives.find(entry => sameLocation(entry.path, location))
    : undefined

  return drive ? driveName(drive, translate) : null
}

export const refreshPlaces = async () => {
  await Promise.all([
    knownFolders()
      .then(found => {
        places.known = found
      })
      .catch(() => undefined),
    drives()
      .then(found => {
        places.drives = found
      })
      .catch(() => undefined),
    listShell(HOME)
      .then(quick => {
        places.pinned = quick.entries.filter(entry => entry.dir)
      })
      .catch(() => undefined),
    networkPlaces()
      .then(found => {
        places.network = found
      })
      .catch(() => undefined),
    wslDistros()
      .then(found => {
        places.linux = found
      })
      .catch(() => undefined),
  ])
}
