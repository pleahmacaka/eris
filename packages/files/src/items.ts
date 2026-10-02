import { extensionOf, joinPath } from "./locations"
import {
  type Drive,
  type Hit,
  type IconMode,
  type Listing,
  type ShellEntry,
  shellImage,
} from "./native"

export type Item = {
  key: string
  path: string
  name: string
  dir: boolean
  size: number
  modified: number
  attrs: number
  kind: string
  parent: string | null
  drive: Drive | null
}

const blank = {
  attrs: 0,
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

const ALWAYS_HIDDEN = new Set([".lnk", ".url"])

export const displayName = (item: Item, showExtensions: boolean) => {
  if (item.dir || item.drive) {
    return item.name
  }

  const extension = extensionOf(item.name)
  const hide =
    ALWAYS_HIDDEN.has(extension) ||
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
