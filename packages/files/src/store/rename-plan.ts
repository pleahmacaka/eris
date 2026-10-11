import type { Item } from "../items"
import { joinPath, parentOf } from "../locations"
import type { NetworkPlace } from "../native"

export const renameLanding = (path: string, name: string) => {
  const parent = parentOf(path)

  return parent ? joinPath(parent, name) : null
}

export const fileRenamePlan = (item: Item, shown: string, draft: string) => {
  const trimmed = draft.trim()
  const name = `${trimmed}${item.name.slice(shown.length)}`

  if (!trimmed || name === item.name) {
    return null
  }

  return { name }
}

export const placeRenameName = (place: NetworkPlace, draft: string) => {
  const name = draft.trim()
  const link = place.entry.toLowerCase().endsWith(".lnk") ? ".lnk" : ""

  return name && name !== place.name ? `${name}${link}` : null
}
