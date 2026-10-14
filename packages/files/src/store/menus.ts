import { tr } from "@eris/i18n"
import {
  contextMenu,
  type MenuAction,
  type MenuItem,
  openContextMenu,
} from "@eris/ui"
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
  invokeVerb,
  mapNetworkDrive,
  nativeMenu,
  openWith,
  type ShellVerb,
} from "../native"
import { archives, isArchive, splitArchive } from "./archive.svelte"
import {
  customCleanup,
  DELAYS,
  delayInstaller,
  hoursLeft,
  keepInstaller,
} from "./cleanup.svelte"
import { hintOf } from "./commands"
import { type Explorer, fail } from "./explorer.svelte"
import { commandEntry, entry, entryIcon, LOCKED_ITEMS } from "./menu-entries"
import { nameDrive, refreshPlaces } from "./places.svelte"
import {
  MENU_SECTIONS,
  type MenuSection,
  prefs,
  type SidebarSection,
  VIEW_ICONS,
  VIEWS,
} from "./prefs.svelte"
import { confirmPrivate, isMarked, toggleMark } from "./privacy.svelte"
import {
  loadShellVerbs,
  rememberVerbs,
  shellItems,
  targetOf,
} from "./shell-verbs"
import {
  hidePath,
  isPinned,
  SIDEBAR_SECTIONS,
  sectionShown,
  toggleSection,
} from "./sidebar"

type Entry = MenuAction | false | null | undefined

const command = (key: string) => tr(`explorer.commands.${key}`)

const compact = (entries: Entry[]) =>
  entries.filter((entry): entry is MenuAction => !!entry)

export const NETWORK_ACTIONS = [
  { key: "mapDrive", run: mapNetworkDrive },
  { key: "unmapDrive", run: disconnectNetworkDrive },
  { key: "addNetworkLocation", run: addNetworkLocation },
].map(action => ({ ...action, icon: entryIcon(action.key) }))

const networkMenu = (x: Explorer): MenuAction[] =>
  NETWORK_ACTIONS.map(action =>
    entry(action.key, () => x.changePlaces(action.run)),
  )

const moreOptions = (action: () => unknown): MenuAction =>
  entry("moreOptions", action)

const pinItem = (x: Explorer, path: string): MenuAction => {
  const pinned = isPinned(path)

  return entry("pin", () => x.pin(path, pinned), {
    label: command(pinned ? "unpin" : "pin"),
    icon: pinned ? "lucide:pin-off" : "lucide:pin",
  })
}

const privateItem = (path: string): MenuAction => {
  const marked = isMarked(path)

  return entry("private", () => toggleMark(path), {
    label: command(marked ? "unmarkPrivate" : "markPrivate"),
    icon: marked ? "lucide:eye" : "lucide:eye-off",
  })
}

const hideDeviceItem = (x: Explorer, path: string): MenuAction => {
  const hidden = prefs.hiddenDevices.includes(path)

  return entry(
    "hideDevice",
    () => {
      prefs.hiddenDevices = hidden
        ? prefs.hiddenDevices.filter(entry => entry !== path)
        : [...prefs.hiddenDevices, path]

      return x.tab.refresh()
    },
    {
      label: command(hidden ? "unhideDevice" : "hideDevice"),
      icon: hidden ? "lucide:eye" : "lucide:eye-off",
    },
  )
}

const hiddenDevicesItem = (x: Explorer): MenuAction => {
  const shown = prefs.showHiddenDevices

  return entry(
    "hiddenDevices",
    () => {
      prefs.showHiddenDevices = !shown

      return x.tab.refresh()
    },
    {
      label: command(shown ? "hideHiddenDevices" : "showHiddenDevices"),
      icon: shown ? "lucide:eye-off" : "lucide:eye",
    },
  )
}

const VERB_WAIT = 120

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const NAME_HEAD = 14

const NAME_TAIL = 8

const clipName = (name: string) => {
  const chars = [...name]

  if (chars.length <= NAME_HEAD + NAME_TAIL + 1) {
    return name
  }

  return `${chars.slice(0, NAME_HEAD).join("")}…${chars.slice(-NAME_TAIL).join("")}`
}

const bandizip = (key: string, name?: string) =>
  tr(
    `explorer.bandizip.${key}`,
    name === undefined ? undefined : { name: clipName(name) },
  )

const stemOf = (item: Item) =>
  item.dir
    ? item.name
    : item.name.slice(0, item.name.length - extensionOf(item.name).length)

const extractMenu = (x: Explorer, packed: Item[]): MenuAction[] => {
  const paths = packed.map(item => item.path)
  const run = (job: BandizipJob) => () => x.bandizip(job, paths)
  const [single] = packed.length === 1 ? packed : []

  return [
    entry("extractHere", run("extractHere")),
    entry("extractAuto", run("extractAuto")),
    entry("extractNamed", run("extractNamed"), {
      label: single
        ? bandizip("extractNamed", stemOf(single))
        : bandizip("extractEach"),
    }),
  ]
}

const bandizipMenu = (x: Explorer): MenuAction[] => {
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
    entry("compressZip", run("compressZip"), {
      label: bandizip("compressZip", name),
    }),
    entry("compress7z", run("compress7z"), {
      label: bandizip("compress7z", name),
    }),
    selection.length > 1 && entry("compressEach", run("compressEach")),
  ])
}

type Sections = Partial<Record<MenuSection, Entry[]>>

const archiveTabMenu = (x: Explorer, open: MenuAction[]): Sections => {
  const packed = splitArchive(x.tab.location)

  if (!packed || !archives.bandizip) {
    return { open }
  }

  const archive = {
    path: packed.archive,
    name: baseName(packed.archive),
    dir: false,
  } as Item

  return { open, archive: extractMenu(x, [archive]) }
}

const visible = (section: MenuSection, items: MenuAction[]) => {
  const { order, hidden } = prefs.menuItems[section]
  const idOf = (item: MenuAction) => item.id ?? ""
  const rank = (item: MenuAction) => {
    const at = order.indexOf(idOf(item))

    return at === -1 ? order.length : at
  }

  return items
    .filter(
      item => !hidden.includes(idOf(item)) || LOCKED_ITEMS.includes(idOf(item)),
    )
    .sort((a, b) => rank(a) - rank(b))
}

const builtIns = (layout: Sections) =>
  MENU_SECTIONS.flatMap(section => compact(layout[section] ?? []))

const arrange = (layout: Sections, shell: MenuAction[]): MenuItem[] => {
  const { order, hidden } = prefs.menuLayout
  const groups = order
    .filter(id => !hidden.includes(id) || id === "properties")
    .map(id => visible(id, id === "shell" ? shell : compact(layout[id] ?? [])))
    .filter(group => group.length > 0)

  return groups.flatMap((group, index): MenuItem[] =>
    index === 0 ? group : ["separator", ...group],
  )
}

const itemMenu = (x: Explorer): Sections => {
  const selection = x.selected
  const keys = selection.map(item => item.key)
  const single = selection.length === 1 ? selection[0] : null
  const folder = single?.dir && !isVirtual(single.path) ? single : null
  const drive = single?.drive ?? null
  const more = moreOptions(() => x.more(keys))

  if (x.tab.kind === "archive") {
    return archiveTabMenu(x, [commandEntry("open", x)])
  }

  if (x.inBin) {
    return {
      edit: [commandEntry("restore", x), commandEntry("deletePermanently", x)],
      properties: [commandEntry("properties", x), more],
    }
  }

  return {
    open: [
      commandEntry("open", x),
      single?.dir && entry("openInNewTab", () => x.openInTab(single.path)),
      single?.dir && entry("openInNewWindow", () => x.openWindow(single.path)),
      single &&
        !single.dir &&
        !isVirtual(single.path) &&
        entry(
          "openWith",
          async () =>
            (await confirmPrivate(single.path, x.tab.location)) &&
            openWith(single.path).catch(fail),
        ),
    ],
    archive: bandizipMenu(x),
    edit: [
      commandEntry("cut", x),
      commandEntry("copy", x),
      commandEntry("copyPath", x),
      x.filesystem &&
        entry("share", () => openShare(selection.map(item => item.path))),
      folder &&
        x.filesystem &&
        entry("syncFolder", () => {
          share.syncFolder = folder.path
          x.go(SHARED)
        }),
      commandEntry("rename", x),
      drive &&
        drive.path in prefs.driveNames &&
        entry("resetName", () => {
          nameDrive(drive, "")

          return x.tab.refresh()
        }),
      commandEntry("delete", x),
    ],
    organize: [
      folder && pinItem(x, folder.path),
      single &&
        x.filesystem &&
        !isVirtual(single.path) &&
        privateItem(single.path),
      drive && x.tab.location === THIS_PC && hideDeviceItem(x, drive.path),
      drive?.kind === "removable" &&
        entry("eject", () =>
          x.changePlaces(() => invokeVerb([drive.path], "eject")),
        ),
      drive?.kind === "network" &&
        entry("disconnect", () =>
          x.changePlaces(() => disconnectDrive(drive.path)),
        ),
    ],
    properties: [commandEntry("properties", x), more],
  }
}

const viewMenu = (x: Explorer, e: MouseEvent): MenuAction =>
  entry(
    "view",
    () =>
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
    { icon: VIEW_ICONS[x.view] },
  )

const backgroundMenu = (
  x: Explorer,
  canPaste: boolean,
  e: MouseEvent,
): Sections => {
  const refresh = commandEntry("refresh", x)
  const more = moreOptions(() => x.more([]))
  const view = x.arrangeable ? [viewMenu(x, e)] : []

  if (x.tab.kind === "archive") {
    return archiveTabMenu(x, [...view, refresh])
  }

  if (x.inBin) {
    return {
      open: [...view, refresh],
      edit: [commandEntry("emptyBin", x)],
      properties: [more],
    }
  }

  if (x.tab.location === THIS_PC) {
    return {
      open: [refresh, prefs.hiddenDevices.length > 0 && hiddenDevicesItem(x)],
      organize: networkMenu(x),
      properties: [more],
    }
  }

  if (!x.filesystem) {
    return { open: [...view, refresh], properties: [more] }
  }

  return {
    open: [...view, refresh],
    edit: [
      { ...commandEntry("paste", x), disabled: !canPaste },
      commandEntry("newFolder", x),
    ],
    properties: [commandEntry("properties", x), more],
  }
}

export const openCleanupMenu = (
  x: Explorer,
  anchor: HTMLElement,
  item: Item,
) => {
  const rect = anchor.getBoundingClientRect()
  const left = hoursLeft(item)

  openContextMenu({
    x: rect.left,
    y: rect.bottom,
    placement: "down",
    anchor,
    items: [
      ...DELAYS.map(({ hours, label }) => ({
        label: tr(`explorer.decor.${label}`, { hours }),
        icon: hours === left ? "lucide:check" : "lucide:clock",
        action: () => delayInstaller(item, hours),
      })),
      {
        label: tr("explorer.decor.deleteAfterCustom"),
        icon: "lucide:pencil",
        action: () => {
          customCleanup.item = item
        },
      },
      "separator",
      {
        label: tr("explorer.decor.keep"),
        icon: "lucide:undo-2",
        action: () => keepInstaller(item),
      },
      {
        label: tr("explorer.decor.deleteNow"),
        icon: "lucide:trash-2",
        action: () => {
          x.tab.select([item.key])

          return x.remove(false)
        },
      },
    ],
  })
}

const verbsFor = (x: Explorer, selection = x.selected) =>
  x.filesystem && x.tab.kind === "folder" && !x.inBin
    ? loadShellVerbs(selection, targetOf(selection, x.tab.location)).catch(
        () => [],
      )
    : null

export const warmMenu = (x: Explorer, selection: Item[]) => {
  verbsFor(x, selection)
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

  const target = targetOf(x.selected, x.tab.location)
  const loading = verbsFor(x)
  const [canPaste, ready] = await Promise.all([
    item ? false : clipboardHasFiles().catch(() => false),
    loading && Promise.race([loading, wait(VERB_WAIT).then(() => null)]),
  ])
  const layout = item ? itemMenu(x) : backgroundMenu(x, canPaste, e)
  const own = builtIns(layout)
  const extend = (verbs: ShellVerb[]) => {
    rememberVerbs(verbs)

    return arrange(layout, shellItems(own, verbs, target, clipName, fail))
  }

  openContextMenu({
    x: e.clientX,
    y: e.clientY,
    placement: "down",
    items: extend(ready ?? []),
  })

  const opened = contextMenu.request

  if (loading && !ready) {
    loading.then(verbs => {
      if (opened && contextMenu.request === opened) {
        opened.items = extend(verbs)
      }
    })
  }
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

  return [
    ...compact([
      entry("open", () => x.go(location)),
      entry("openInNewTab", () => x.openInTab(location)),
      entry("openInNewWindow", () => x.openWindow(location)),
    ]),
    "separator",
    ...compact([
      !SINGLE.includes(location) &&
        !isVirtual(location) &&
        pinItem(x, location),
      (section === "network" ||
        (section === "drives" && location !== THIS_PC)) &&
        entry("rename", () => x.renamePlace(location)),
      hide && {
        label: tr("explorer.sidebar.hide"),
        icon: "lucide:eye-off",
        action: () =>
          hide === "section" ? toggleSection(section) : hidePath(location),
      },
      own && entry("properties", () => x.properties([location])),
      own && moreOptions(showNative),
    ]),
    "separator",
    customize(x),
  ]
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
