import {
  Channel,
  convertFileSrc,
  type InvokeArgs,
  invoke,
} from "@tauri-apps/api/core"

export type RawEntry = {
  name: string
  dir: boolean
  size: number
  modified: number
  attrs: number
  link: boolean
}

export type Listing = {
  path: string
  entries: RawEntry[]
  types: Record<string, string>
}

export type Hit = RawEntry & { parent: string; kind: string }

export type ShellEntry = {
  key: string
  path: string
  name: string
  dir: boolean
  size: number
  modified: number
  kind: string
}

export type ShellListing = { path: string; name: string; entries: ShellEntry[] }

export type KnownId =
  | "home"
  | "desktop"
  | "downloads"
  | "documents"
  | "pictures"
  | "music"
  | "videos"

export type Known = { id: KnownId; path: string }

export type DriveKind = "removable" | "fixed" | "network" | "optical" | "ram"

export type Drive = {
  path: string
  label: string
  kind: DriveKind
  free: number
  total: number
  remote: string
  connected: boolean
}

export type Distro = { name: string; path: string }

export type NetworkPlace = Distro & { entry: string }

export type Resolved = { path: string; select: string | null; file: boolean }

export type Intent = { path: string | null; select: string | null }

export type ExplorerSettings = { showHidden: boolean; showExtensions: boolean }

export type DefaultApp = { supported: boolean; enabled: boolean }

export type Model = { obj: string; mtl: string | null }

export type IconMode = "icon" | "item" | "thumb"

export type Packed = {
  path: string
  dir: boolean
  size: number
  modified: number
}

export type ArchiveListing = {
  entries: Packed[]
  types: Record<string, string>
  folder: string
}

export type BandizipJob =
  | "extractHere"
  | "extractAuto"
  | "extractNamed"
  | "compressZip"
  | "compress7z"
  | "compressEach"

export const call = <T>(command: string, args?: InvokeArgs) =>
  invoke<T>(`plugin:eris-files|${command}`, args)

export const listDir = (path: string) => call<Listing>("list_dir", { path })

export const listShell = (path: string) =>
  call<ShellListing>("list_shell", { path })

export const searchDir = (
  root: string,
  query: string,
  token: number,
  onhits: (hits: Hit[]) => void,
) => {
  const batch = new Channel<Hit[]>()

  batch.onmessage = onhits

  return call<void>("search_dir", {
    root,
    query,
    token,
    batch,
  })
}

export const cancelSearch = (token: number) =>
  call<void>("cancel_search", { token })

export const measureDirs = (paths: string[], token: number) =>
  call<number | null>("measure_dirs", { paths, token })

export const randomToken = () => crypto.getRandomValues(new Uint32Array(1))[0]

export const watchDir = (slot: string, path: string | null) =>
  call<void>("watch_dir", { slot, path })

export const knownFolders = () => call<Known[]>("known_folders")

export const drives = () => call<Drive[]>("drives")

export const wslDistros = () => call<Distro[]>("wsl_distros")

export const listArchive = (path: string) =>
  call<ArchiveListing>("list_archive", { path })

export const extractEntry = (archive: string, entry: string) =>
  call<string>("extract_entry", { archive, entry })

export const bandizipAvailable = () => call<boolean>("bandizip_available")

export const bandizipJob = (job: BandizipJob, items: string[]) =>
  call<string[]>("bandizip_job", { job, items })

export const screenSharing = () => call<boolean>("screen_sharing")

export const explorerSettings = () =>
  call<ExplorerSettings>("explorer_settings")

export const runAddress = (input: string, cwd: string | null) =>
  call<Resolved | null>("run_address", { input, cwd })

export const networkPlaces = () => call<NetworkPlace[]>("network_places")

export const reconnectDrive = (path: string) =>
  call<void>("reconnect_drive", { path })

export const disconnectDrive = (path: string) =>
  call<void>("disconnect_drive", { path })

export const mapNetworkDrive = () => call<void>("map_network_drive")

export const disconnectNetworkDrive = () =>
  call<void>("disconnect_network_drive")

export const addNetworkLocation = () => call<void>("add_network_location")

export const openItem = (item: string) =>
  call<string | null>("open_item", { item })

export const openWith = (path: string) => call<void>("open_with", { path })

export const showProperties = (items: string[]) =>
  call<void>("show_properties", { items })

export const emptyRecycleBin = () => call<void>("empty_recycle_bin")

export const nativeMenu = (
  items: string[],
  folder: string | null,
  extended: boolean,
) =>
  call<string | null>("native_menu", {
    items,
    folder,
    extended,
  })

export const invokeVerb = (items: string[], verb: string) =>
  call<void>("invoke_verb", { items, verb })

export const startDrag = (items: string[]) =>
  call<void>("start_drag", { items })

export const copyItems = (items: string[], target: string) =>
  call<void>("transfer_items", { items, target, cut: false })

export const moveItems = (items: string[], target: string) =>
  call<void>("transfer_items", { items, target, cut: true })

export const deleteItems = (items: string[], permanent: boolean) =>
  call<void>("delete_items", { items, permanent })

export const renameItem = (item: string, name: string) =>
  call<void>("rename_item", { item, name })

export const newFolder = (parent: string, name: string) =>
  call<string>("new_folder", { parent, name })

export const setClipboard = (items: string[], cut: boolean) =>
  call<void>("set_clipboard", { items, cut })

export const pasteItems = (target: string) =>
  call<string[]>("paste_items", { target })

export const clipboardHasFiles = () => call<boolean>("clipboard_has_files")

export const allowPreview = (path: string) =>
  call<void>("allow_preview", { path })

export const previewText = (path: string) =>
  call<string>("preview_text", { path })

export const modelFiles = (path: string) => call<Model>("model_files", { path })

export const openViewer = (path: string) => call<void>("open_viewer", { path })

export const isMujoco = (path: string) => call<boolean>("is_mujoco", { path })

export const takeIntent = () => call<Intent>("take_intent")

export const newWindow = (path: string | null) =>
  call<void>("new_window", { path })

export const defaultAppStatus = () => call<DefaultApp>("default_app_status")

export const setDefaultApp = (enabled: boolean) =>
  call<DefaultApp>("set_default_app", { enabled })

export const openDefaultApps = () => call<void>("open_default_apps")

export const shellImage = (
  mode: IconMode,
  size: number,
  key: string,
  version = 0,
) => `${convertFileSrc(`${mode}/${size}/${key}`, "shell")}?v=${version}`

export const assetUrl = (path: string) => convertFileSrc(path)
