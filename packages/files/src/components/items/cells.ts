import { currentLocale } from "@eris/i18n"
import { formatDate, formatKilobytes } from "../../format"
import { displayName, type Item } from "../../items"
import { prefs, type SortKey } from "../../store/prefs.svelte"

export const kindText = (item: Item, results: boolean) =>
  results ? (item.parent ?? item.kind) : item.kind

export const cellText = (item: Item, key: SortKey, results: boolean) => {
  if (key === "name") {
    return displayName(item, prefs.showExtensions)
  }

  if (key === "modified") {
    return formatDate(item.modified, currentLocale())
  }

  if (key === "kind") {
    return kindText(item, results)
  }

  return item.dir ? "" : formatKilobytes(item.size, currentLocale())
}
