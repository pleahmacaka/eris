import { isAudio } from "../filetypes"
import { fromListing, iconPixels, iconSource } from "../items"
import { isUnc, isVirtual, normalize, sameLocation } from "../locations"
import { type Listing, listDir } from "../native"
import { places } from "./places.svelte"

const HOVER_REST = 80
const LIFE = 15_000
const LIMIT = 24
const WARM_ICONS = 40

const cache = new Map<string, { at: number; listing: Promise<Listing> }>()

const remote = (path: string) =>
  isUnc(path) ||
  places.drives.some(
    drive => !!drive.remote && sameLocation(drive.path, path.slice(0, 3)),
  )

export const takePrefetched = (location: string) => {
  const path = normalize(location)
  const hit = cache.get(path)

  cache.delete(path)

  return hit && Date.now() - hit.at < LIFE ? hit.listing : null
}

export const prefetch = (location: string) => {
  const path = normalize(location)
  const hit = cache.get(path)

  if (isVirtual(path) || isAudio(path) || remote(path)) {
    return
  }

  if (hit && Date.now() - hit.at < LIFE) {
    return
  }

  cache.delete(path)

  const oldest = cache.keys().next().value

  if (cache.size >= LIMIT && oldest !== undefined) {
    cache.delete(oldest)
  }

  const listing = listDir(path)

  cache.set(path, { at: Date.now(), listing })

  listing
    .then(found => {
      for (const item of fromListing(found).slice(0, WARM_ICONS)) {
        new Image().src = iconSource(item, iconPixels(1))
      }
    })
    .catch(() => cache.delete(path))
}

export const prefetchOnHover =
  (location: string | null) => (node: HTMLElement) => {
    if (!location || location.startsWith("pidl:")) {
      return
    }

    let timer: ReturnType<typeof setTimeout> | undefined

    const enter = () => {
      timer = setTimeout(() => prefetch(location), HOVER_REST)
    }

    const leave = () => clearTimeout(timer)

    node.addEventListener("pointerenter", enter)
    node.addEventListener("pointerleave", leave)

    return () => {
      leave()
      node.removeEventListener("pointerenter", enter)
      node.removeEventListener("pointerleave", leave)
    }
  }
