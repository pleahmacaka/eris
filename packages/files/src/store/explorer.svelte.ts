import { currentLocale, tr } from "@eris/i18n"
import { toast } from "@eris/ui"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { writeText } from "@tauri-apps/plugin-clipboard-manager"
import { displayName, type Item, packedEntry } from "../items"
import { baseName, HOME, RECYCLE_BIN } from "../locations"
import * as native from "../native"
import { isArchive } from "./archive.svelte"
import { arrange } from "./arrange"
import { fail, failed } from "./command-errors"
import * as opening from "./open-commands"
import { nameDrive, placeName, places, refreshPlaces } from "./places.svelte"
import {
  type GroupKey,
  prefs,
  type SortKey,
  type ViewMode,
} from "./prefs.svelte"
import { confirmAll, confirmPrivate } from "./privacy.svelte"
import * as renaming from "./rename-commands"
import * as shell from "./shell-commands"
import { pinnedEntry } from "./sidebar"
import { Tab } from "./tab.svelte"
import * as transferring from "./transfer-commands"
import { transferPlan } from "./transfer-plan"
import { groupKeyOf, viewPlan } from "./view-plan"

export { fail } from "./command-errors"

// Concrete bindings stay at the reactive boundary. Workflows receive only their
// domain services and a live context; they never import Explorer or UI stores.
const openServices: opening.OpenServices = {
  native,
  fail,
  failed,
  confirmPrivate,
  isArchive,
  packedEntry,
}

const transferServices: transferring.TransferServices = {
  native,
  fail,
  failed,
  writeText,
  confirmAll,
  archiveNotice: done =>
    toast(
      tr(`explorer.bandizip.${done ? "done" : "working"}`),
      done ? "success" : undefined,
    ),
}

const renameServices: renaming.RenameServices = {
  native,
  fail,
  failed,
  network: () => places.network,
  nameDrive,
  refreshPlaces,
  displayName: item => displayName(item, prefs.showExtensions),
}

const shellServices: shell.ShellServices = {
  native,
  fail,
  failed,
  confirmAll,
  refreshPlaces,
  pinnedKey: location => pinnedEntry(location)?.key,
  newFolderName: () => tr("explorer.commands.newFolder"),
}

const sectionOf = (item: Item) => {
  if (item.drive) {
    return item.drive.kind === "network" ? "network" : "drives"
  }

  if (places.linux.some(distro => distro.path === item.path)) {
    return "linux"
  }

  return places.known.some(known => known.path === item.path)
    ? "folders"
    : "network"
}

export class Explorer {
  tabs = $state<Tab[]>([])

  active = $state(0)

  tab = $derived(this.tabs[this.active])

  settingsOpen = $state(false)

  setupOpen = $state(false)

  dropKey = $state<string | null>(null)

  dropHint = $state<{
    x: number
    y: number
    into: string
    move: boolean
    count: number
  } | null>(null)

  #layout = $derived(
    viewPlan(this.tab.location, !!this.tab.results, prefs, places.known),
  )

  arrangeable = $derived(this.#layout.arrangeable)

  own = $derived(this.#layout.own)

  folder = $derived(this.#layout.folder)

  group: GroupKey = $derived(this.#layout.group)

  view: ViewMode = $derived(this.#layout.view)

  arranged = $derived(
    arrange(
      this.tab.results ?? this.tab.items,
      { ...this.folder, group: this.group },
      {
        showHidden: prefs.showHidden,
        locale: currentLocale(),
        sectionOf: this.arrangeable ? null : sectionOf,
      },
    ),
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

  async open(item: Item): Promise<unknown> {
    return opening.openItem(this, item, openServices)
  }

  async bandizip(job: native.BandizipJob, paths: string[]) {
    return transferring.bandizip(this, job, paths, transferServices)
  }

  openSelected() {
    return opening.openSelection(this)
  }

  openInTab(location: string) {
    const current = this.active

    this.newTab(location)
    this.active = current
  }

  openWindow(location: string) {
    shell.openWindow(location, shellServices)
  }

  async clip(cut: boolean) {
    return transferring.clipSelection(this, cut, transferServices)
  }

  copyPath() {
    transferring.copySelectionPath(this, transferServices)
  }

  async paste() {
    return transferring.paste(this, transferServices)
  }

  dropPlan(paths: string[], target: string | null = null) {
    return transferPlan(paths, this.tab.location, this.filesystem, target)
  }

  async drop(paths: string[], target: string | null = null) {
    return transferring.drop(this, paths, target, transferServices)
  }

  async drag() {
    return transferring.drag(this, transferServices)
  }

  renamable = (item: Item) => renaming.renamable(this, item, renameServices)

  rename() {
    renaming.rename(this, renameServices)
  }

  async renamePlace(location: string) {
    return renaming.renamePlace(this, location)
  }

  async commitRename(item: Item, draft: string) {
    return renaming.commitRename(this, item, draft, renameServices)
  }

  async remove(permanent: boolean) {
    return shell.remove(this, permanent, shellServices)
  }

  async newFolder() {
    return shell.newFolder(this, shellServices)
  }

  properties(keys = this.selected.map(item => item.key)) {
    shell.properties(this, keys, shellServices)
  }

  async more(keys: string[], extended = false) {
    return shell.more(this, keys, extended, shellServices)
  }

  async pin(location: string, pinned: boolean) {
    return shell.pin(location, pinned, shellServices)
  }

  async restore() {
    return shell.restore(this, shellServices)
  }

  async emptyBin() {
    return shell.emptyBin(this, shellServices)
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
    if (!this.arrangeable) {
      return
    }

    if (this.own) {
      this.own.group = group
    } else {
      prefs.groups[groupKeyOf(this.tab.location)] = group
    }
  }

  toggleFolderOnly() {
    const key = groupKeyOf(this.tab.location)

    if (this.own) {
      delete prefs.folderViews[key]
    } else if (this.arrangeable) {
      prefs.folderViews[key] = { ...this.folder, group: this.group }
    }
  }

  toggleDateGroups() {
    this.setGroup(this.group === "modified" ? "none" : "modified")
  }

  async changePlaces(run: () => Promise<unknown>) {
    return shell.changePlaces(this, run, shellServices)
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
