import { type Appearance, standaloneLook, type ThemeMode } from "@eris/settings"
import { cloneDeep } from "es-toolkit"
import type { ExpiryPreset } from "../components/share/expiry"
import { known, persisted } from "./persisted.svelte"

export type ViewMode =
  | "details"
  | "list"
  | "tiles"
  | "small"
  | "medium"
  | "large"

export type SortKey = "name" | "modified" | "kind" | "size"

export type GroupKey = "none" | "modified" | "kind"

export type FolderType = "general" | "downloads" | "pictures" | "videos"

export type IconStyle = "system" | "ide"

export type CleanupColor = "orange" | "red" | "amber" | "primary"

export type FolderPane = "git" | "readme"

export type FolderView = {
  view: ViewMode
  sort: SortKey
  ascending: boolean
  group: GroupKey
}

export type SidebarSection =
  | "home"
  | "pinned"
  | "folders"
  | "drives"
  | "network"
  | "linux"
  | "shared"
  | "recycleBin"

export type Sidebar = {
  hidden: SidebarSection[]
  hiddenPaths: string[]
  order: string[]
}

export type Arrangement<T extends string> = { order: T[]; hidden: T[] }

export type RepoPart = "logo" | "host" | "repo" | "branch" | "fork"

export type GitHost = { domain: string; name: string; logo: string | null }

export type RememberedVerb = { id: string; label: string; icon: string | null }

export type MenuSection =
  | "open"
  | "shell"
  | "archive"
  | "edit"
  | "organize"
  | "properties"

export const REPO_PARTS: RepoPart[] = ["logo", "host", "repo", "branch", "fork"]

export const MENU_SECTIONS: MenuSection[] = [
  "open",
  "shell",
  "archive",
  "edit",
  "organize",
  "properties",
]

export const MENU_ITEMS: Record<MenuSection, string[]> = {
  open: [
    "open",
    "openInNewTab",
    "openInNewWindow",
    "openWith",
    "view",
    "refresh",
    "hiddenDevices",
  ],
  shell: [],
  archive: [
    "extractHere",
    "extractAuto",
    "extractNamed",
    "compressZip",
    "compress7z",
    "compressEach",
  ],
  edit: [
    "cut",
    "copy",
    "paste",
    "copyPath",
    "share",
    "syncFolder",
    "rename",
    "resetName",
    "delete",
    "restore",
    "deletePermanently",
    "newFolder",
    "emptyBin",
  ],
  organize: [
    "pin",
    "private",
    "hideDevice",
    "eject",
    "disconnect",
    "mapDrive",
    "unmapDrive",
    "addNetworkLocation",
  ],
  properties: ["properties", "moreOptions"],
}

const arrangement = <T extends string>(
  ids: T[],
  saved?: Partial<Arrangement<T>>,
): Arrangement<T> => {
  const order = (saved?.order ?? []).filter(id => ids.includes(id))

  return {
    order: [...order, ...ids.filter(id => !order.includes(id))],
    hidden: (saved?.hidden ?? []).filter(id => ids.includes(id)),
  }
}

export type Prefs = {
  folders: Record<FolderType, FolderView>
  showHidden: boolean
  showExtensions: boolean
  preview: boolean
  selectionInMore: boolean
  compactToolbar: boolean
  navWidth: number
  previewWidth: number
  columns: Record<SortKey, number>
  followEris: boolean
  mode: ThemeMode
  look: Appearance
  setupDone: boolean
  shareExpiry: ExpiryPreset
  sidebar: Sidebar
  driveNames: Record<string, string>
  privatePaths: string[]
  groups: Record<string, GroupKey>
  folderViews: Record<string, FolderView>
  iconStyle: IconStyle
  duplicates: boolean
  gitColors: boolean
  emptyFolders: boolean
  cleanup: boolean
  cleanupHours: number
  cleanupSince: number
  cleanupColor: CleanupColor
  cleanupKeep: string[]
  cleanupDeadlines: Record<string, number>
  folderPane: FolderPane
  readmeRaw: boolean
  trustedRepos: string[]
  repoChip: Arrangement<RepoPart>
  gitHosts: GitHost[]
  menuLayout: Arrangement<MenuSection>
  menuItems: Record<MenuSection, Arrangement<string>>
  shellVerbs: RememberedVerb[]
  hiddenDevices: string[]
  showHiddenDevices: boolean
}

export const VIEWS: ViewMode[] = [
  "large",
  "medium",
  "small",
  "list",
  "details",
  "tiles",
]

export const VIEW_ICONS: Record<ViewMode, string> = {
  large: "lucide:image",
  medium: "lucide:layout-grid",
  small: "lucide:grid-3x3",
  list: "lucide:list",
  details: "lucide:table-2",
  tiles: "lucide:layout-list",
}

export const VIEW_KEYS: Record<ViewMode, number> = {
  large: 2,
  medium: 3,
  small: 4,
  list: 5,
  details: 6,
  tiles: 7,
}

export const SORT_KEYS: SortKey[] = ["name", "modified", "kind", "size"]

export const GROUP_KEYS: GroupKey[] = ["none", "modified", "kind"]

export const FOLDER_VIEWS: Record<FolderType, FolderView> = {
  general: { view: "details", sort: "name", ascending: true, group: "none" },
  downloads: {
    view: "details",
    sort: "modified",
    ascending: false,
    group: "modified",
  },
  pictures: { view: "large", sort: "name", ascending: true, group: "none" },
  videos: { view: "large", sort: "name", ascending: true, group: "none" },
}

const KEY = "eris-files.prefs"

const folders = (saved?: Partial<Prefs["folders"]>): Prefs["folders"] => ({
  general: { ...FOLDER_VIEWS.general, ...saved?.general },
  downloads: { ...FOLDER_VIEWS.downloads, ...saved?.downloads },
  pictures: { ...FOLDER_VIEWS.pictures, ...saved?.pictures },
  videos: { ...FOLDER_VIEWS.videos, ...saved?.videos },
})

const menuItems = (
  saved?: Partial<Prefs["menuItems"]>,
  verbs: RememberedVerb[] = [],
): Prefs["menuItems"] => ({
  open: arrangement(MENU_ITEMS.open, saved?.open),
  shell: arrangement(
    verbs.map(verb => verb.id),
    saved?.shell,
  ),
  archive: arrangement(MENU_ITEMS.archive, saved?.archive),
  edit: arrangement(MENU_ITEMS.edit, saved?.edit),
  organize: arrangement(MENU_ITEMS.organize, saved?.organize),
  properties: arrangement(MENU_ITEMS.properties, saved?.properties),
})

const defaults: Prefs = {
  folders: folders(),
  showHidden: false,
  showExtensions: false,
  preview: false,
  selectionInMore: false,
  compactToolbar: false,
  navWidth: 15,
  previewWidth: 20,
  columns: { name: 20, modified: 10, kind: 10, size: 6 },
  followEris: true,
  mode: "system",
  look: standaloneLook,
  setupDone: false,
  shareExpiry: "day",
  sidebar: { hidden: [], hiddenPaths: [], order: [] },
  driveNames: {},
  privatePaths: [],
  groups: {},
  folderViews: {},
  iconStyle: "ide",
  duplicates: true,
  gitColors: true,
  emptyFolders: true,
  cleanup: true,
  cleanupHours: 24,
  cleanupSince: 0,
  cleanupColor: "orange",
  cleanupKeep: [],
  cleanupDeadlines: {},
  folderPane: "readme",
  readmeRaw: false,
  trustedRepos: [],
  repoChip: arrangement(REPO_PARTS, { hidden: ["host"] }),
  gitHosts: [],
  menuLayout: arrangement(MENU_SECTIONS),
  menuItems: menuItems(),
  shellVerbs: [],
  hiddenDevices: [],
  showHiddenDevices: false,
}

const fresh = localStorage.getItem(KEY) === null

export const firstRun = () => fresh

export const prefs = persisted(KEY, defaults, saved => ({
  ...known(defaults, saved),
  folders: folders(saved.folders),
  columns: { ...defaults.columns, ...saved.columns },
  sidebar: { ...defaults.sidebar, ...saved.sidebar },
  repoChip: arrangement(REPO_PARTS, saved.repoChip ?? defaults.repoChip),
  menuLayout: arrangement(MENU_SECTIONS, saved.menuLayout),
  menuItems: menuItems(saved.menuItems, saved.shellVerbs),
  look: {
    ...standaloneLook,
    mode: saved.mode ?? standaloneLook.mode,
    ...saved.look,
  },
  setupDone: saved.setupDone ?? !fresh,
}))

export const resetPrefs = () => {
  Object.assign(prefs, cloneDeep(defaults), { setupDone: true })
}
