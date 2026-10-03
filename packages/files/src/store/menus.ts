import { tr } from "@eris/i18n"
import { type MenuAction, type MenuItem, openContextMenu } from "@eris/ui"
import { openShare, share } from "../components/share/share.svelte"
import type { Item } from "../items"
import {
  baseName,
  extensionOf,
  HOME,
  isVirtual,
  RECYCLE_BIN,
  SHARED,
  THIS_PC,
} from "../locations"
import {
  addNetworkLocation,
  type BandizipJob,
  clipboardHasFiles,
  disconnectDrive,
  disconnectNetworkDrive,
  mapNetworkDrive,
  nativeMenu,
  openWith,
} from "../native"
import { archives, isArchive, splitArchive } from "./archive.svelte"
import { hintOf, menuItem } from "./commands"
import { type Explorer, fail } from "./explorer.svelte"
import { nameDrive, refreshPlaces } from "./places.svelte"
import { prefs, type SidebarSection, VIEW_ICONS, VIEWS } from "./prefs.svelte"
import { confirmPrivate, isMarked, toggleMark } from "./privacy.svelte"
import {
  hidePath,
  isPinned,
  SIDEBAR_SECTIONS,
  sectionShown,
  toggleSection,
} from "./sidebar"

type Entry = MenuItem | false | null | undefined

const command = (key: string) => tr(`explorer.commands.${key}`)

const compact = (entries: Entry[]) =>
  entries.filter((entry): entry is MenuItem => !!entry)

export const NETWORK_ACTIONS = [
  { key: "mapDrive", icon: "lucide:hard-drive-upload", run: mapNetworkDrive },
  { key: "unmapDrive", icon: "lucide:unplug", run: disconnectNetworkDrive },
  {
    key: "addNetworkLocation",
    icon: "lucide:folder-plus",
    run: addNetworkLocation,
  },
]

const networkMenu = (x: Explorer): MenuAction[] =>
  NETWORK_ACTIONS.map(entry => ({
    label: command(entry.key),
    icon: entry.icon,
    action: () => x.changePlaces(entry.run),
  }))

const moreOptions = (action: () => unknown): MenuAction => ({
  label: command("moreOptions"),
  icon: "lucide:ellipsis",
  action,
})

const pinItem = (x: Explorer, path: string): MenuAction => {
  const pinned = isPinned(path)

  return {
    label: command(pinned ? "unpin" : "pin"),
    icon: pinned ? "lucide:pin-off" : "lucide:pin",
    action: () => x.pin(path, pinned),
  }
}

const privateItem = (path: string): MenuAction => {
  const marked = isMarked(path)

  return {
    label: command(marked ? "unmarkPrivate" : "markPrivate"),
    icon: marked ? "lucide:eye" : "lucide:eye-off",
    action: () => toggleMark(path),
  }
}

const bandizip = (key: string, values?: Record<string, string>) =>
  tr(`explorer.bandizip.${key}`, values)

const stemOf = (item: Item) =>
  item.dir
    ? item.name
    : item.name.slice(0, item.name.length - extensionOf(item.name).length)

const extractMenu = (x: Explorer, archivesToExtract: Item[]): MenuItem[] => {
  const paths = archivesToExtract.map(item => item.path)
  const run = (job: BandizipJob) => () => x.bandizip(job, paths)
  const [single] = archivesToExtract.length === 1 ? archivesToExtract : []

  return [
    "separator",
    {
      label: bandizip("extractHere"),
      icon: "lucide:package-open",
      action: run("extractHere"),
    },
    {
      label: bandizip("extractAuto"),
      icon: "lucide:wand-sparkles",
      action: run("extractAuto"),
    },
    {
      label: single
        ? bandizip("extractNamed", { name: stemOf(single) })
        : bandizip("extractEach"),
      icon: "lucide:folder-output",
      action: run("extractNamed"),
    },
  ]
}

const bandizipMenu = (x: Explorer): MenuItem[] => {
  const selection = x.selected

  if (!archives.bandizip || !x.filesystem || !selection.length) {
    return []
  }

  if (selection.every(item => !item.dir && isArchive(item.name))) {
    return extractMenu(x, selection)
  }

  const paths = selection.map(item => item.path)
  const run = (job: BandizipJob) => () => x.bandizip(job, paths)
  const name =
    selection.length === 1 ? stemOf(selection[0]) : baseName(x.tab.location)

  return compact([
    "separator",
    {
      label: bandizip("compressZip", { name }),
      icon: "lucide:file-archive",
      action: run("compressZip"),
    },
    {
      label: bandizip("compress7z", { name }),
      icon: "lucide:file-archive",
      action: run("compress7z"),
    },
    selection.length > 1 && {
      label: bandizip("compressEach"),
      icon: "lucide:files",
      action: run("compressEach"),
    },
  ])
}

const archiveTabMenu = (x: Explorer, items: MenuItem[]): MenuItem[] => {
  const packed = splitArchive(x.tab.location)

  if (!packed || !archives.bandizip) {
    return items
  }

  const archive = {
    path: packed.archive,
    name: baseName(packed.archive),
    dir: false,
  } as Item

  return [...items, ...extractMenu(x, [archive])]
}

const itemMenu = (x: Explorer): MenuItem[] => {
  const selection = x.selected
  const keys = selection.map(item => item.key)
  const single = selection.length === 1 ? selection[0] : null
  const folder = single?.dir && !isVirtual(single.path) ? single : null
  const drive = single?.drive ?? null
  const more = moreOptions(() => x.more(keys))

  if (x.tab.kind === "archive") {
    return archiveTabMenu(x, [menuItem("open", x)])
  }

  if (x.inBin) {
    return [
      menuItem("restore", x),
      menuItem("deletePermanently", x),
      "separator",
      menuItem("properties", x),
      more,
    ]
  }

  return compact([
    menuItem("open", x),
    single?.dir && {
      label: command("openInNewTab"),
      icon: "lucide:panel-top",
      action: () => x.openInTab(single.path),
    },
    single?.dir && {
      label: command("openInNewWindow"),
      icon: "lucide:app-window",
      action: () => x.openWindow(single.path),
    },
    single &&
      !single.dir &&
      !isVirtual(single.path) && {
        label: command("openWith"),
        icon: "lucide:layout-grid",
        action: async () =>
          (await confirmPrivate(single.path, x.tab.location)) &&
          openWith(single.path).catch(fail),
      },
    ...bandizipMenu(x),
    "separator",
    menuItem("cut", x),
    menuItem("copy", x),
    menuItem("copyPath", x),
    x.filesystem && {
      label: tr("share.action"),
      icon: "lucide:share-2",
      action: () => openShare(selection.map(item => item.path)),
    },
    folder &&
      x.filesystem && {
        label: tr("share.sync.menu"),
        icon: "lucide:folder-sync",
        action: () => {
          share.syncFolder = folder.path
          x.go(SHARED)
        },
      },
    menuItem("rename", x),
    drive &&
      drive.path in prefs.driveNames && {
        label: command("resetName"),
        icon: "lucide:rotate-ccw",
        action: () => {
          nameDrive(drive, "")

          return x.tab.refresh()
        },
      },
    menuItem("delete", x),
    "separator",
    folder && pinItem(x, folder.path),
    single &&
      x.filesystem &&
      !isVirtual(single.path) &&
      privateItem(single.path),
    single?.drive?.kind === "network" && {
      label: command("disconnect"),
      icon: "lucide:unplug",
      action: () => x.changePlaces(() => disconnectDrive(single.path)),
    },
    menuItem("properties", x),
    more,
  ])
}

const viewMenu = (x: Explorer, e: MouseEvent): MenuAction => ({
  label: command("view"),
  icon: VIEW_ICONS[x.view],
  action: () =>
    openContextMenu({
      x: e.clientX,
      y: e.clientY,
      placement: "down",
      items: [
        ...VIEWS.map(mode => ({
          label: tr(`explorer.views.${mode}`),
          icon: mode === x.view ? "lucide:check" : VIEW_ICONS[mode],
          hint: hintOf(`view.${mode}`),
          action: () => x.setView(mode),
        })),
        "separator",
        {
          label: tr("explorer.views.dateGroups"),
          icon: x.group === "modified" ? "lucide:check" : "lucide:calendar",
          action: () => x.toggleDateGroups(),
        },
        {
          label: tr("explorer.views.folderOnly"),
          icon: x.own ? "lucide:check" : "lucide:folder-cog",
          action: () => x.toggleFolderOnly(),
        },
      ],
    }),
})

const backgroundMenu = (
  x: Explorer,
  canPaste: boolean,
  e: MouseEvent,
): MenuItem[] => {
  const refresh = menuItem("refresh", x)
  const more = moreOptions(() => x.more([]))
  const view = x.arrangeable ? [viewMenu(x, e)] : []

  if (x.tab.kind === "archive") {
    return archiveTabMenu(x, [...view, refresh])
  }

  if (x.inBin) {
    return [menuItem("emptyBin", x), ...view, refresh, more]
  }

  if (x.tab.location === THIS_PC) {
    return [refresh, "separator", ...networkMenu(x), more]
  }

  if (!x.filesystem) {
    return [...view, refresh, more]
  }

  return [
    ...view,
    refresh,
    "separator",
    { ...menuItem("paste", x), disabled: !canPaste },
    menuItem("newFolder", x),
    "separator",
    menuItem("properties", x),
    more,
  ]
}

export const openMenu = async (
  x: Explorer,
  e: MouseEvent,
  item: Item | null,
) => {
  e.preventDefault()

  if (!item) {
    x.tab.select([])
  } else if (!x.tab.selection.has(item.key)) {
    x.tab.select([item.key])
  }

  const canPaste = await clipboardHasFiles().catch(() => false)

  openContextMenu({
    x: e.clientX,
    y: e.clientY,
    placement: "down",
    items: item ? itemMenu(x) : backgroundMenu(x, canPaste, e),
  })
}

export type Place = {
  location: string
  section: SidebarSection
  hide: "section" | "path" | null
}

const SINGLE: string[] = [HOME, THIS_PC, RECYCLE_BIN, SHARED]

const customize = (x: Explorer): MenuAction => ({
  label: tr("explorer.sidebar.customize"),
  icon: "lucide:settings",
  action: () => {
    x.settingsOpen = true
  },
})

const placeMenu = (x: Explorer, place: Place): MenuItem[] => {
  const { location, section, hide } = place
  const own = location !== SHARED
  const showNative = async () => {
    const verb = await nativeMenu([location], null, false).catch(() => null)

    if (verb !== null) {
      await refreshPlaces()
    }
  }

  return compact([
    {
      label: command("open"),
      icon: "lucide:square-arrow-out-up-right",
      action: () => x.go(location),
    },
    {
      label: command("openInNewTab"),
      icon: "lucide:panel-top",
      action: () => x.openInTab(location),
    },
    {
      label: command("openInNewWindow"),
      icon: "lucide:app-window",
      action: () => x.openWindow(location),
    },
    "separator",
    !SINGLE.includes(location) && !isVirtual(location) && pinItem(x, location),
    hide && {
      label: tr("explorer.sidebar.hide"),
      icon: "lucide:eye-off",
      action: () =>
        hide === "section" ? toggleSection(section) : hidePath(location),
    },
    own && {
      label: command("properties"),
      icon: "lucide:info",
      action: () => x.properties([location]),
    },
    own && moreOptions(showNative),
    "separator",
    customize(x),
  ])
}

const sectionsMenu = (x: Explorer): MenuItem[] => [
  ...SIDEBAR_SECTIONS.map(id => ({
    label: tr(`explorer.sidebar.sections.${id}`),
    icon: sectionShown(id) ? "lucide:eye" : "lucide:eye-off",
    action: () => toggleSection(id),
  })),
  "separator",
  customize(x),
]

export const openPlaceMenu = (
  x: Explorer,
  e: MouseEvent,
  place: Place | null,
) => {
  e.preventDefault()
  e.stopPropagation()

  openContextMenu({
    x: e.clientX,
    y: e.clientY,
    placement: "down",
    items: place ? placeMenu(x, place) : sectionsMenu(x),
  })
}
