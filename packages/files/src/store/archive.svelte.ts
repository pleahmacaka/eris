import { extensionOf, isVirtual } from "../locations"
import { type ArchiveListing, bandizipAvailable, listArchive } from "../native"

const READABLE = new Set([
  ".zip",
  ".7z",
  ".rar",
  ".tar",
  ".tgz",
  ".tbz",
  ".tbz2",
  ".gz",
  ".bz2",
  ".lzh",
  ".lha",
])

const BANDIZIP_ONLY = new Set([
  ".zipx",
  ".alz",
  ".egg",
  ".xz",
  ".txz",
  ".zst",
  ".tzst",
])

export const archives = $state({ bandizip: false, folder: "" })

bandizipAvailable()
  .then(found => {
    archives.bandizip = found
  })
  .catch(() => undefined)

export const isArchive = (name: string) => {
  const extension = extensionOf(name)

  return (
    READABLE.has(extension) ||
    (archives.bandizip && BANDIZIP_ONLY.has(extension))
  )
}

export const splitArchive = (location: string) => {
  if (isVirtual(location)) {
    return null
  }

  const parts = location.split("\\")
  const at = parts.findIndex((part, index) => index > 0 && isArchive(part))

  if (at < 0) {
    return null
  }

  return {
    archive: parts.slice(0, at + 1).join("\\"),
    inner: parts
      .slice(at + 1)
      .filter(Boolean)
      .join("\\"),
  }
}

const listings = new Map<string, Promise<ArchiveListing>>()

export const archiveListing = (path: string, fresh: boolean) => {
  const key = path.toLowerCase()
  const cached = listings.get(key)

  if (cached && !fresh) {
    return cached
  }

  const pending = listArchive(path).then(listing => {
    archives.folder = listing.folder

    return listing
  })

  listings.set(key, pending)
  pending.catch(() => listings.delete(key))

  return pending
}
