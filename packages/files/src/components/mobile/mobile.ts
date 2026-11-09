import { fileGlyph } from "../../fileicons"
import { assetUrl, call } from "../../native"

export type Entry = {
  name: string
  path: string
  dir: boolean
  size: number
  modified: number
}

export type Folder = {
  path: string
  root: string
  parent: string | null
  roots: string[]
  entries: Entry[]
}

export type SortKey = "name" | "modified" | "size"

export type Sort = { key: SortKey; descending: boolean }

const MEDIA = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "heic",
  "avif",
  "mp4",
  "mkv",
  "mov",
  "webm",
  "3gp",
  "m4v",
])

export const CATEGORIES = [
  {
    folder: "Download",
    label: "mobile.categories.download",
    icon: "lucide:download",
    tone: "text-info bg-info/15",
  },
  {
    folder: "Documents",
    label: "mobile.categories.documents",
    icon: "lucide:file-text",
    tone: "text-warning bg-warning/15",
  },
  {
    folder: "DCIM",
    label: "mobile.categories.camera",
    icon: "lucide:camera",
    tone: "text-success bg-success/15",
  },
  {
    folder: "Pictures",
    label: "mobile.categories.pictures",
    icon: "lucide:image",
    tone: "text-accent bg-accent/15",
  },
  {
    folder: "Movies",
    label: "mobile.categories.videos",
    icon: "lucide:film",
    tone: "text-secondary bg-secondary/15",
  },
  {
    folder: "Music",
    label: "mobile.categories.music",
    icon: "lucide:music",
    tone: "text-error bg-error/15",
  },
]

const FOLDERS: Record<string, string> = {
  download: "material-icon-theme:folder-download",
  dcim: "material-icon-theme:folder-images",
  camera: "material-icon-theme:folder-images",
  pictures: "material-icon-theme:folder-images",
  screenshots: "material-icon-theme:folder-images",
  movies: "material-icon-theme:folder-video",
  "screen recordings": "material-icon-theme:folder-video",
  music: "material-icon-theme:folder-audio",
  audiobooks: "material-icon-theme:folder-audio",
  podcasts: "material-icon-theme:folder-audio",
  recordings: "material-icon-theme:folder-audio",
  ringtones: "material-icon-theme:folder-audio",
  alarms: "material-icon-theme:folder-audio",
  notifications: "material-icon-theme:folder-audio",
  documents: "material-icon-theme:folder-docs",
  android: "material-icon-theme:folder-android",
}

const FILES: Record<string, string> = {
  apk: "material-icon-theme:android",
  doc: "material-icon-theme:word",
  docx: "material-icon-theme:word",
  hwp: "material-icon-theme:word",
  xls: "material-icon-theme:table",
  xlsx: "material-icon-theme:table",
  csv: "material-icon-theme:table",
  ppt: "material-icon-theme:powerpoint",
  pptx: "material-icon-theme:powerpoint",
  pdf: "material-icon-theme:pdf",
}

const extension = (name: string) =>
  name.slice(name.lastIndexOf(".") + 1).toLowerCase()

export const iconOf = (entry: Entry) =>
  entry.dir
    ? (FOLDERS[entry.name.toLowerCase()] ?? "material-icon-theme:folder-base")
    : (FILES[extension(entry.name)] ??
      fileGlyph(entry.name) ??
      "material-icon-theme:document")

export const keepAlive = (enabled: boolean) =>
  call<void>("keep_alive", { enabled }).catch(() => undefined)

export const sendToBack = () => call<void>("send_to_back")

const thumbs = new Map<string, Promise<string>>()

export const thumbnailUrl = (path: string, modified: number) => {
  const key = `${path}:${modified}`
  const known = thumbs.get(key)

  if (known) {
    return known
  }

  const found = call<{ path: string }>("thumbnail", { path, size: 160 }).then(
    reply => assetUrl(reply.path),
  )

  found.catch(() => thumbs.delete(key))
  thumbs.set(key, found)

  return found
}

export const storageStats = (path: string) =>
  call<{ total: number; free: number }>("storage_stats", { path })

export const isMedia = (name: string) => MEDIA.has(extension(name))

export const listFolder = (path: string | null) =>
  call<Folder>("share_local", { path })

export const openFile = (path: string) => call<void>("open_file", { path })

export const openWith = (path: string) => call<void>("open_with", { path })

export const shareFiles = (paths: string[]) =>
  call<void>("share_files", { paths })

export const scanFiles = (paths: string[]) =>
  call<void>("scan_files", { paths }).catch(() => undefined)

export const storageAccess = () =>
  call<{ granted: boolean }>("storage_access").then(reply => reply.granted)

export const requestStorage = () => call<void>("request_storage")

export const newFolder = (parent: string, name: string) =>
  call<string>("new_folder", { parent, name })

export const renameItem = (item: string, name: string) =>
  call<void>("rename_item", { item, name })

export const deleteItems = (items: string[]) =>
  call<void>("delete_items", { items, permanent: true })

export const setClipboard = (items: string[], cut: boolean) =>
  call<void>("set_clipboard", { items, cut })

export const pasteItems = (target: string) =>
  call<string[]>("paste_items", { target })

export const sortEntries = (entries: Entry[], sort: Sort, locale: string) => {
  const collator = new Intl.Collator(locale, {
    numeric: true,
    sensitivity: "base",
  })
  const direction = sort.descending ? -1 : 1

  const compare = (a: Entry, b: Entry) => {
    if (sort.key === "modified") {
      return a.modified - b.modified
    }

    if (sort.key === "size") {
      return a.size - b.size
    }

    return collator.compare(a.name, b.name)
  }

  return [...entries].sort(
    (a, b) => Number(b.dir) - Number(a.dir) || direction * compare(a, b),
  )
}
