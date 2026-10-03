import { tr } from "@eris/i18n"
import { isAudio } from "../filetypes"
import {
  fromArchive,
  fromDrive,
  fromFolder,
  fromHit,
  fromListing,
  fromShell,
  type Item,
} from "../items"
import {
  HOME,
  isVirtual,
  normalize,
  parentOf,
  SHARED,
  sameLocation,
  THIS_PC,
} from "../locations"
import {
  cancelSearch,
  listDir,
  listShell,
  randomToken,
  reconnectDrive,
  searchDir,
  watchDir,
} from "../native"
import { archiveListing, splitArchive } from "./archive.svelte"
import { driveName, places, refreshPlaces } from "./places.svelte"
import { takePrefetched } from "./prefetch"
import { confirmPrivate } from "./privacy.svelte"

export type TabKind = "folder" | "virtual" | "audio" | "shared" | "archive"

type Loaded = {
  location: string
  shellName: string
  items: Item[]
  kind: TabKind
  cached: boolean
}

type OpenOptions = { record?: boolean; select?: string | null; keep?: boolean }

const loadThisPc = async (): Promise<Item[]> => {
  await refreshPlaces()

  const folders = places.known
    .filter(known => known.id !== "home")
    .map(known =>
      fromFolder(
        known.path,
        tr(`explorer.places.${known.id}`),
        tr("explorer.places.folder"),
      ),
    )

  const disks = places.drives.map(drive =>
    fromDrive(
      drive,
      driveName(drive, key => tr(key)),
      tr(`explorer.drive.${drive.kind === "fixed" ? "local" : drive.kind}`),
    ),
  )

  const network = places.network.map(place =>
    fromFolder(place.path, place.name, tr("explorer.places.networkLocation")),
  )

  const linux = places.linux.map(distro =>
    fromFolder(distro.path, distro.name, tr("explorer.places.linuxDistro")),
  )

  return [...folders, ...disks, ...network, ...linux]
}

const reconnect = async (location: string) => {
  if (location[1] !== ":") {
    return
  }

  if (!places.drives.length) {
    await refreshPlaces()
  }

  const offline = places.drives.find(
    drive => !drive.connected && sameLocation(drive.path, location.slice(0, 3)),
  )

  if (offline) {
    await reconnectDrive(offline.path).catch(() => undefined)
    await refreshPlaces()
  }
}

const kindOf = (location: string): TabKind =>
  location === SHARED
    ? "shared"
    : isVirtual(location)
      ? "virtual"
      : splitArchive(location)
        ? "archive"
        : isAudio(location)
          ? "audio"
          : "folder"

const load = async (location: string, useCache: boolean): Promise<Loaded> => {
  const kind = kindOf(location)
  const plain = { shellName: "", items: [], kind, cached: false }

  if (sameLocation(location, THIS_PC)) {
    return { ...plain, location: THIS_PC, items: await loadThisPc() }
  }

  if (kind === "shared") {
    return { ...plain, location: SHARED }
  }

  if (kind === "virtual") {
    const listing = await listShell(location)

    return {
      ...plain,
      location: normalize(location),
      shellName: listing.name,
      items: listing.entries.map(fromShell),
    }
  }

  await reconnect(location)

  if (kind === "audio") {
    return { ...plain, location: normalize(location) }
  }

  const packed = kind === "archive" ? splitArchive(location) : null

  if (packed) {
    const listing = await archiveListing(packed.archive, !useCache)

    return {
      ...plain,
      location: normalize(location),
      items: fromArchive(
        normalize(location),
        packed.archive,
        packed.inner,
        listing,
      ),
    }
  }

  const prefetched = useCache ? takePrefetched(location) : null
  const listing = await (prefetched ?? listDir(normalize(location)))

  return {
    ...plain,
    location: normalize(listing.path),
    items: fromListing(listing),
    cached: !!prefetched,
  }
}

const CHANGE_SETTLE = 250

let tabs = 0

export class Tab {
  id = ++tabs

  location = $state("")

  kind = $state<TabKind>("folder")

  shellName = $state("")

  items = $state.raw<Item[]>([])

  loading = $state(false)

  error = $state<string | null>(null)

  history = $state.raw<string[]>([])

  cursor = $state(-1)

  selection = $state.raw(new Set<string>())

  focus = $state<string | null>(null)

  anchor = $state<string | null>(null)

  query = $state("")

  results = $state.raw<Item[] | null>(null)

  searching = $state(false)

  renaming = $state<string | null>(null)

  canBack = $derived(this.cursor > 0)

  canForward = $derived(this.cursor < this.history.length - 1)

  canUp = $derived(parentOf(this.location) !== null)

  #sequence = 0

  #token = 0

  #watched: string | null = null

  #settle: ReturnType<typeof setTimeout> | undefined

  async open(location: string, options: OpenOptions = {}) {
    if (!(await confirmPrivate(location, this.location))) {
      return
    }

    const sequence = ++this.#sequence
    const previous = this.selection
    const moving = !sameLocation(location, this.location)

    this.loading = true

    if (!options.keep) {
      this.stopSearch()
      this.renaming = null
    }

    try {
      const loaded = await load(location, moving && !options.keep)

      if (sequence !== this.#sequence) {
        return
      }

      this.location = loaded.location
      this.kind = loaded.kind
      this.shellName = loaded.shellName
      this.items = loaded.items
      this.error = null
      this.#record(loaded.location, options.record ?? true)
      this.#watch()

      const keys = new Set(loaded.items.map(item => item.key))

      if (options.select) {
        this.select([options.select])
      } else if (options.keep) {
        const keep = (key: string | null) => (key && keys.has(key) ? key : null)

        this.selection = new Set([...previous].filter(key => keys.has(key)))
        this.focus = keep(this.focus)
        this.anchor = keep(this.anchor)
      } else {
        this.select([])
      }

      if (loaded.cached) {
        this.refresh()
      }
    } catch (reason) {
      if (sequence !== this.#sequence) {
        return
      }

      this.location = normalize(location)
      this.kind = kindOf(location)
      this.shellName = ""
      this.items = []
      this.error = String(reason)
      this.#record(this.location, options.record ?? true)
      this.#unwatch()
      this.select([])
    } finally {
      if (sequence === this.#sequence) {
        this.loading = false
      }
    }
  }

  #record(location: string, record: boolean) {
    if (!record || sameLocation(this.history[this.cursor] ?? "", location)) {
      return
    }

    this.history = [...this.history.slice(0, this.cursor + 1), location]
    this.cursor = this.history.length - 1
  }

  #watch() {
    const target = this.kind === "folder" ? this.location : null

    if (target !== this.#watched) {
      this.#watched = target
      watchDir(String(this.id), target).catch(() => undefined)
    }
  }

  #unwatch() {
    if (this.#watched !== null) {
      this.#watched = null
      watchDir(String(this.id), null).catch(() => undefined)
    }
  }

  changed() {
    clearTimeout(this.#settle)

    this.#settle = setTimeout(() => {
      if (!this.renaming && !this.loading) {
        this.refresh()
      }
    }, CHANGE_SETTLE)
  }

  dispose() {
    clearTimeout(this.#settle)
    this.stopSearch()
    this.#unwatch()
  }

  select(keys: string[], focus = keys.at(-1) ?? null) {
    this.selection = new Set(keys)
    this.focus = focus
    this.anchor = focus
  }

  toggle(key: string) {
    const next = new Set(this.selection)

    if (!next.delete(key)) {
      next.add(key)
    }

    this.selection = next
    this.focus = key
    this.anchor = key
  }

  extendTo(keys: string[], key: string, additive: boolean) {
    const at = keys.indexOf(key)
    const anchor = this.anchor ? keys.indexOf(this.anchor) : -1
    const from = anchor < 0 ? at : anchor
    const range = keys.slice(Math.min(from, at), Math.max(from, at) + 1)

    this.selection = new Set([...(additive ? this.selection : []), ...range])
    this.focus = key
  }

  refresh() {
    return this.open(this.location || HOME, { record: false, keep: true })
  }

  back() {
    if (this.canBack) {
      this.cursor -= 1
      this.open(this.history[this.cursor], { record: false })
    }
  }

  forward() {
    if (this.canForward) {
      this.cursor += 1
      this.open(this.history[this.cursor], { record: false })
    }
  }

  up() {
    const parent = parentOf(this.location)

    if (parent) {
      this.open(parent, { select: this.location })
    }
  }

  search(query: string) {
    this.stopSearch()
    this.query = query

    const needle = query.trim().toLowerCase()

    if (!needle) {
      this.results = null

      return
    }

    if (this.kind !== "folder") {
      this.results = this.items.filter(item =>
        item.name.toLowerCase().includes(needle),
      )

      return
    }

    const token = randomToken()

    this.#token = token
    this.results = []
    this.searching = true

    searchDir(this.location, query, token, hits => {
      if (this.#token === token) {
        this.results = [...(this.results ?? []), ...hits.map(fromHit)]
      }
    })
      .catch(() => undefined)
      .finally(() => {
        if (this.#token === token) {
          this.searching = false
        }
      })
  }

  stopSearch() {
    if (this.#token) {
      cancelSearch(this.#token).catch(() => undefined)
    }

    this.#token = 0
    this.searching = false
  }

  clearSearch() {
    this.stopSearch()
    this.query = ""
    this.results = null
  }
}
