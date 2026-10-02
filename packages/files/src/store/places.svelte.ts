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
} from "../native"

export const places = $state<{
  known: Known[]
  drives: Drive[]
  pinned: ShellEntry[]
  network: NetworkPlace[]
}>({ known: [], drives: [], pinned: [], network: [] })

const shareName = (remote: string) => {
  const parts = remote.split("\\").filter(Boolean)

  return parts.length > 1
    ? `${parts.at(-1)} (\\\\${parts.slice(0, -1).join("\\")})`
    : remote
}

export const driveName = (drive: Drive, translate: (key: string) => string) => {
  const kind = drive.kind === "fixed" ? "local" : drive.kind
  const label =
    (drive.remote && shareName(drive.remote)) ||
    drive.label ||
    translate(`explorer.drive.${kind}`)

  return `${label} (${drive.path.slice(0, 2)})`
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
  ])
}
