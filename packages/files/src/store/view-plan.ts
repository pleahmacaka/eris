import { isControlPanel, normalize, sameLocation, THIS_PC } from "../locations"
import type { Known, KnownId } from "../native"
import type { FolderType, Prefs } from "./prefs.svelte"

const FOLDER_TYPES: Partial<Record<KnownId, FolderType>> = {
  downloads: "downloads",
  pictures: "pictures",
  videos: "videos",
}

// This preference key intentionally folds case on every platform.
export const groupKeyOf = (location: string) =>
  normalize(location).toLowerCase()

export const viewPlan = (
  location: string,
  results: boolean,
  prefs: Pick<Prefs, "folderViews" | "folders" | "groups">,
  known: Known[],
) => {
  const key = groupKeyOf(location)
  const own = prefs.folderViews[key]
  const place = known.find(entry => sameLocation(entry.path, location))
  const type = (place && FOLDER_TYPES[place.id]) ?? "general"
  const folder = own ?? prefs.folders[type]
  const group = own?.group ?? prefs.groups[key] ?? folder.group
  const arrangeable = !(location === THIS_PC && !results)
  const tiled = !arrangeable || (!own && isControlPanel(location))

  return {
    own,
    folder,
    group,
    arrangeable,
    view: tiled ? ("tiles" as const) : folder.view,
  }
}
