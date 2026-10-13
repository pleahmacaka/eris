import { untrack } from "svelte"
import type { Item } from "../items"
import { CLOUD_ONLY, extensionOf, sameLocation } from "../locations"
import { cleanupPlan, installers } from "../native"
import { places } from "./places.svelte"
import { prefs } from "./prefs.svelte"

const HOUR = 3_600_000
const TICK = 60_000
const CACHE_LIMIT = 2000
const KEEP_LIMIT = 200

const INSTALLER_EXTENSIONS = new Set([".exe", ".msi"])

export const CLEANUP_HOURS = [6, 12, 24, 48, 72]

export const clock = $state({ now: Date.now() })

const verdicts = new Map<string, boolean>()

export const enableCleanup = (on: boolean) => {
  prefs.cleanup = on
  prefs.cleanupSince = on ? Date.now() : 0
}

const bornOf = (item: Item) => item.created || item.modified

const deadlineOf = (item: Item) =>
  Math.max(bornOf(item), prefs.cleanupSince) + prefs.cleanupHours * HOUR

export const hoursLeft = (item: Item) =>
  Math.max(0, Math.ceil((deadlineOf(item) - clock.now) / HOUR))

const keepKey = (item: Item) => `${item.name}|${bornOf(item)}`

export const isKept = (item: Item) => prefs.cleanupKeep.includes(keepKey(item))

export const keepInstaller = (item: Item) => {
  if (!isKept(item)) {
    prefs.cleanupKeep = [...prefs.cleanupKeep, keepKey(item)].slice(-KEEP_LIMIT)
  }
}

const downloadsPath = () =>
  places.known.find(known => known.id === "downloads")?.path ?? null

export const isDownloads = (location: string) => {
  const downloads = downloadsPath()

  return downloads !== null && sameLocation(downloads, location)
}

const verdictKey = (item: Item) => `${item.path}|${item.modified}`

export const findInstallers = async (items: Item[]) => {
  const executables = items.filter(
    item =>
      !item.dir &&
      !(item.attrs & CLOUD_ONLY) &&
      INSTALLER_EXTENSIONS.has(extensionOf(item.name)),
  )
  const unknown = executables.filter(item => !verdicts.has(verdictKey(item)))

  if (unknown.length > 0) {
    const found = new Set(await installers(unknown.map(item => item.path)))

    if (verdicts.size > CACHE_LIMIT) {
      verdicts.clear()
    }

    for (const item of unknown) {
      verdicts.set(verdictKey(item), found.has(item.path))
    }
  }

  return new Set(
    executables
      .filter(item => verdicts.get(verdictKey(item)))
      .map(item => item.path),
  )
}

export const startCleanup = () => {
  untrack(() => {
    clock.now = Date.now()

    if (prefs.cleanup && !prefs.cleanupSince) {
      prefs.cleanupSince = Date.now()
    }
  })

  const ticker = setInterval(() => (clock.now = Date.now()), TICK)

  return () => clearInterval(ticker)
}

export const syncCleanupPlan = () => {
  const folder = downloadsPath()
  const plan =
    prefs.cleanup && folder
      ? {
          folder,
          hours: prefs.cleanupHours,
          since: prefs.cleanupSince,
          keep: prefs.cleanupKeep,
        }
      : null

  cleanupPlan(plan).catch(() => undefined)
}
