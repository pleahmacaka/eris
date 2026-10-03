import { addCollection } from "@iconify/svelte/dist/offline-functions"
import type { LayoutLoad } from "./$types"

export const load: LayoutLoad = ({ data }) => {
  for (const set of data.icons) {
    addCollection(set)
  }

  return data
}
