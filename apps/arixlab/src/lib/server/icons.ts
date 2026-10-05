import { getIcons } from "@iconify/utils"
import { icons as lucide } from "@iconify-json/lucide"
import { icons as simpleIcons } from "@iconify-json/simple-icons"

const pick = (set: typeof lucide, names: string[]) => {
  const subset = getIcons(set, names, true)

  if (!subset || subset.not_found) {
    throw new Error(`${set.prefix} icons not found: ${subset?.not_found}`)
  }

  return subset
}

export const icons = [
  pick(lucide, [
    "activity",
    "arrow-right",
    "arrow-up-right",
    "check",
    "code-xml",
    "columns-2",
    "download",
    "eye",
    "file-text",
    "folder-open",
    "layout-template",
    "link-2",
    "list-tree",
    "mail",
    "monitor",
    "search",
    "smartphone",
    "sun-moon",
    "user-round",
  ]),
  pick(simpleIcons, ["github", "npm"]),
]
