import { extensionOf, joinPath } from "./locations"
import {
  type ArchiveListing,
  type Drive,
  type Hit,
  type IconMode,
  type Listing,
  type ShellEntry,
  shellImage,
} from "./native"
import { archives } from "./store/archive.svelte"

export type Item = {
  key: string
  path: string
  name: string
  dir: boolean
  size: number
  modified: number
  attrs: number
  link: boolean
  kind: string
  parent: string | null
  drive: Drive | null
  packed?: string
}

const blank = {
  attrs: 0,
  link: false,
  parent: null,
  drive: null,
}

export const fromListing = (listing: Listing): Item[] =>
  listing.entries.map(entry => {
    const path = joinPath(listing.path, entry.name)

    return {
      ...blank,
      ...entry,
      key: path,
      path,
      kind: entry.dir
        ? (listing.types["/"] ?? "")
        : (listing.types[extensionOf(entry.name)] ?? ""),
    }
  })

export const fromHit = (hit: Hit): Item => {
  const path = joinPath(hit.parent, hit.name)

  return { ...blank, ...hit, key: path, path }
}

export const fromShell = (entry: ShellEntry): Item => ({ ...blank, ...entry })

export const fromArchive = (
  location: string,
  archive: string,
  inner: string,
  listing: ArchiveListing,
): Item[] => {
  const prefix = inner ? `${inner.toLowerCase()}\\` : ""
  const found = new Map<string, Item>()

  for (const entry of listing.entries) {
    if (!entry.path.toLowerCase().startsWith(prefix)) {
      continue
    }

    const rest = entry.path.slice(prefix.length)
    const cut = rest.indexOf("\\")
    const own = cut < 0
    const name = own ? rest : rest.slice(0, cut)
    const key = name.toLowerCase()

    if (!name || (found.has(key) && !own)) {
      continue
    }

    const dir = !own || entry.dir
    const path = joinPath(location, name)

    found.set(key, {
      ...blank,
      key: path,
      path,
      name,
      dir,
      size: dir ? 0 : entry.size,
      modified: own ? entry.modified : 0,
      kind: dir
        ? (listing.types["/"] ?? "")
        : (listing.types[extensionOf(name)] ?? ""),
      packed: archive,
    })
  }

  return [...found.values()]
}

export const packedEntry = (item: Item) =>
  item.packed ? item.path.slice(item.packed.length + 1) : ""

export const fromFolder = (path: string, name: string, kind: string): Item => ({
  ...blank,
  key: path,
  path,
  name,
  dir: true,
  size: 0,
  modified: 0,
  kind,
})

export const fromDrive = (drive: Drive, name: string, kind: string): Item => ({
  ...blank,
  key: drive.path,
  path: drive.path,
  name,
  dir: true,
  size: drive.total,
  modified: 0,
  kind,
  drive,
})

const SHORTCUTS = new Set([".lnk", ".url"])

export const isShortcut = (item: Item) =>
  item.link || (!item.dir && SHORTCUTS.has(extensionOf(item.path)))

export const displayName = (item: Item, showExtensions: boolean) => {
  if (item.dir || item.drive) {
    return item.name
  }

  const extension = extensionOf(item.name)
  const hide =
    SHORTCUTS.has(extension) ||
    (!showExtensions && item.name.length > extension.length)

  return hide && extension
    ? item.name.slice(0, item.name.length - extension.length)
    : item.name
}

const PER_ITEM = new Set([
  ".exe",
  ".lnk",
  ".ico",
  ".url",
  ".cur",
  ".ani",
  ".msc",
  ".cpl",
  ".scr",
  ".appref-ms",
])

const THUMBNAILS = new Set([
  ".jpg",
  ".jpeg",
  ".jfif",
  ".png",
  ".gif",
  ".bmp",
  ".webp",
  ".heic",
  ".heif",
  ".avif",
  ".tif",
  ".tiff",
  ".mp4",
  ".mkv",
  ".mov",
  ".avi",
  ".wmv",
  ".webm",
  ".m4v",
  ".pdf",
  ".psd",
])

const SIZES = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256]

const samples = new Map<string, string>()

export const iconPixels = (rem: number) =>
  SIZES.find(size => size >= rem * 16 * window.devicePixelRatio) ?? 256

export const iconSource = (item: Item, pixels: number, thumbnail = false) => {
  const extension = extensionOf(item.name)

  if (item.packed) {
    return item.dir
      ? shellImage("item", pixels, archives.folder)
      : shellImage("icon", pixels, item.path)
  }
  const mode: IconMode =
    item.key.startsWith("pidl:") || item.dir
      ? "item"
      : thumbnail && THUMBNAILS.has(extension)
        ? "thumb"
        : PER_ITEM.has(extension)
          ? "item"
          : "icon"

  if (mode !== "icon") {
    return shellImage(mode, pixels, item.key, item.modified)
  }

  if (!samples.has(extension)) {
    samples.set(extension, item.path)
  }

  return shellImage(mode, pixels, samples.get(extension) ?? item.path)
}

export const forgetSample = (item: Item) => {
  samples.delete(extensionOf(item.name))
}
