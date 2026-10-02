import { currentLocale, tr } from "@eris/i18n"
import { toast } from "@eris/ui"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { kindOf } from "../filetypes"
import { displayName, type Item } from "../items"
import {
  baseName,
  HOME,
  isVirtual,
  joinPath,
  parentOf,
  RECYCLE_BIN,
  sameLocation,
  THIS_PC,
} from "../locations"
import * as native from "../native"
import { arrange } from "./arrange"
import { placeName, places, refreshPlaces } from "./places.svelte"
import {
  type FolderType,
  type GroupKey,
  prefs,
  type SortKey,
  type ViewMode,
} from "./prefs.svelte"
import { Tab } from "./tab.svelte"

const FOLDER_TYPES: Partial<Record<native.KnownId, FolderType>> = {
  downloads: "downloads",
  pictures: "pictures",
  videos: "videos",
}

export const fail = (reason: unknown) => {
  const text = String(reason)
  const key = `explorer.errors.${text}`
  const message = tr(key)

  if (text !== "cancelled") {
    toast(message === key ? text : message, "error")
  }
}

const failed = (reason: unknown) => {
  fail(reason)

  return null
}

const sameDrive = (a: string, b: string) =>
  a.slice(0, 2).toLowerCase() === b.slice(0, 2).toLowerCase() && a[1] === ":"

const sectionOf = (item: Item) => {
  if (item.drive) {
    return item.drive.kind === "network" ? "network" : "drives"
  }

  return places.known.some(known => known.path === item.path)
    ? "folders"
    : "network"
}

const folderTypeOf = (location: string): FolderType => {
  const known = places.known.find(entry => sameLocation(entry.path, location))

  return (known && FOLDER_TYPES[known.id]) ?? "general"
}

export class Explorer {
  tabs = $state<Tab[]>([])

  active = $state(0)

  tab = $derived(this.tabs[this.active])

  settingsOpen = $state(false)

  dropKey = $state<string | null>(null)

  arrangeable = $derived(!(this.tab.location === THIS_PC && !this.tab.results))

  folder = $derived(prefs.folders[folderTypeOf(this.tab.location)])

  view: ViewMode = $derived(this.arrangeable ? this.folder.view : "tiles")

  arranged = $derived(
    arrange(this.tab.results ?? this.tab.items, this.folder, {
      showHidden: prefs.showHidden,
      locale: currentLocale(),
      sectionOf: this.arrangeable ? null : sectionOf,
    }),
  )

  visible = $derived(this.arranged.items)

  sections = $derived(this.arranged.sections)

  selected = $derived(
    this.visible.filter(item => this.tab.selection.has(item.key)),
  )

  focused = $derived(
    this.visible.find(item => item.key === this.tab.focus) ?? null,
  )

  filesystem = $derived(this.tab.kind === "folder")

  inBin = $derived(this.tab.location === RECYCLE_BIN)

  constructor(location = HOME, select: string | null = null) {
    this.newTab(location, select)
  }

  newTab(location = HOME, select: string | null = null) {
    const tab = new Tab()

    this.tabs.push(tab)
    this.active = this.tabs.length - 1
    tab.open(location, { select })

    return tab
  }

  close(index = this.active) {
    if (this.tabs.length <= 1) {
      getCurrentWindow().close()

      return
    }

    const [closed] = this.tabs.splice(index, 1)

    closed.dispose()
    this.active = Math.min(
      index <= this.active ? Math.max(0, this.active - 1) : this.active,
      this.tabs.length - 1,
    )
  }

  cycleTab(delta: number) {
    const count = this.tabs.length

    this.active = (this.active + delta + count) % count
  }

  go(location: string, select: string | null = null) {
    this.tab.clearSearch()
    this.tab.open(location, { select })
  }

  async open(item: Item) {
    if (item.dir) {
      return this.go(item.path)
    }

    const kind = isVirtual(item.path) ? null : kindOf(item.name)

    if (kind === "model") {
      return native.openViewer(item.path).catch(fail)
    }

    if (kind === "audio") {
      return this.go(item.path)
    }

    const folder = await native.openItem(item.key).catch(failed)

    if (folder) {
      this.go(folder)
    }
  }

  openSelected() {
    const [first, ...rest] = this.selected

    if (!first) {
      return
    }

    if (!rest.length) {
      return this.open(first)
    }

    for (const item of this.selected.filter(item => !item.dir)) {
      this.open(item)
    }

    const folder = this.selected.find(item => item.dir)

    if (folder) {
      this.go(folder.path)
    }
  }

  openInTab(location: string) {
    const current = this.active

    this.newTab(location)
    this.active = current
  }

  openWindow(location: string) {
    native.newWindow(location).catch(fail)
  }

  async clip(cut: boolean) {
    const paths = this.selected.map(item => item.path)

    if (paths.length) {
      await native.setClipboard(paths, cut).catch(fail)
    }
  }

  copyPath() {
    const text = this.selected.map(item => `"${item.path}"`).join("\r\n")

    if (text) {
      writeText(text).catch(fail)
    }
  }

  async paste() {
    if (!this.filesystem) {
      return
    }

    const tab = this.tab
    const landed = (await native.pasteItems(tab.location).catch(failed)) ?? []

    await tab.refresh()

    const present = landed.filter(path =>
      tab.items.some(item => item.key === path),
    )

    if (present.length) {
      tab.select(present)
    }
  }

  async drop(paths: string[], target: string | null = null) {
    const into = target ?? (this.filesystem ? this.tab.location : null)

    if (!into || !paths.length) {
      return
    }

    const inside = (path: string) =>
      sameLocation(path, into) ||
      into.toLowerCase().startsWith(`${path.toLowerCase()}\\`)
    const sources = paths.filter(path => !inside(path))
    const move = sources.every(path => sameDrive(path, into))
    const changed = move
      ? sources.filter(path => !sameLocation(parentOf(path) ?? "", into))
      : sources

    if (!changed.length) {
      return
    }

    await (move ? native.moveItems : native.copyItems)(changed, into).catch(
      fail,
    )
    await this.tab.refresh()
  }

  async drag() {
    const keys = this.selected.map(item => item.key)

    if (keys.length) {
      await native.startDrag(keys).catch(fail)
      await this.tab.refresh()
    }
  }

  rename() {
    const target = this.focused ?? this.selected[0]

    if (target && this.filesystem) {
      this.tab.select([target.key])
      this.tab.renaming = target.key
    }
  }

  async commitRename(item: Item, draft: string) {
    const tab = this.tab
    const shown = displayName(item, prefs.showExtensions)
    const hidden = item.name.slice(shown.length)
    const name = `${draft.trim()}${hidden}`

    tab.renaming = null

    if (!draft.trim() || name === item.name) {
      return
    }

    await native.renameItem(item.key, name).catch(fail)

    const parent = parentOf(item.path)

    await tab.refresh()

    if (parent) {
      tab.select([joinPath(parent, name)])
    }
  }

  async remove(permanent: boolean) {
    const keys = this.selected.map(item => item.key)

    if (keys.length) {
      await native.deleteItems(keys, permanent || this.inBin).catch(fail)
      await this.tab.refresh()
    }
  }

  async newFolder() {
    if (!this.filesystem) {
      return
    }

    const tab = this.tab
    const created = await native
      .newFolder(tab.location, tr("explorer.commands.newFolder"))
      .catch(failed)

    if (created) {
      await tab.open(tab.location, { record: false, select: created })
      tab.renaming = created
    }
  }

  properties(keys = this.selected.map(item => item.key)) {
    native.showProperties(keys.length ? keys : [this.tab.location]).catch(fail)
  }

  async more(keys: string[], extended = false) {
    const verb = await native
      .nativeMenu(keys, keys.length ? null : this.tab.location, extended)
      .catch(failed)

    if (verb === "rename") {
      return this.rename()
    }

    if (verb !== null) {
      await Promise.all([this.tab.refresh(), refreshPlaces()])
    }
  }

  async pin(location: string, pinned: boolean) {
    await native
      .invokeVerb([location], pinned ? "unpinfromhome" : "pintohome")
      .catch(fail)
    await refreshPlaces()
  }

  async restore() {
    const keys = this.selected.map(item => item.key)

    if (keys.length) {
      await native.invokeVerb(keys, "undelete").catch(fail)
      await this.tab.refresh()
    }
  }

  async emptyBin() {
    await native.emptyRecycleBin().catch(fail)

    if (this.inBin) {
      await this.tab.refresh()
    }
  }

  selectAll() {
    this.tab.select(this.visible.map(item => item.key))
  }

  invertSelection() {
    this.tab.select(
      this.visible
        .filter(item => !this.tab.selection.has(item.key))
        .map(item => item.key),
    )
  }

  setView(view: ViewMode) {
    if (this.arrangeable) {
      this.folder.view = view
    }
  }

  setSort(
    key: SortKey,
    ascending = this.folder.sort === key
      ? !this.folder.ascending
      : key === "name",
  ) {
    if (this.arrangeable) {
      this.folder.sort = key
      this.folder.ascending = ascending
    }
  }

  setGroup(group: GroupKey) {
    if (this.arrangeable) {
      this.folder.group = group
    }
  }

  async changePlaces(run: () => Promise<unknown>) {
    await run().catch(fail)

    if (this.tab.location === THIS_PC) {
      await this.tab.refresh()
    } else {
      await refreshPlaces()
    }
  }

  title(tab: Tab, translate: (key: string) => string) {
    const named = placeName(tab.location, translate)

    if (named) {
      return named
    }

    return tab.kind === "virtual"
      ? tab.shellName || tab.location
      : baseName(tab.location)
  }
}
