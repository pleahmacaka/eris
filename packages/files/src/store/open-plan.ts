import { kindOf } from "../filetypes"
import type { Item } from "../items"
import { isVirtual } from "../locations"

export type OpenPlan = "navigate" | "extract" | "viewer" | "probeXml" | "shell"

// Archive availability is supplied by the reactive archive store, not copied here.
export const openPlan = (item: Item, archive: boolean): OpenPlan => {
  if (item.dir) {
    return "navigate"
  }

  if (item.packed) {
    return "extract"
  }

  const virtual = isVirtual(item.path)

  if (!virtual && archive) {
    return "navigate"
  }

  const kind = virtual ? null : kindOf(item.name)

  if (kind === "model") {
    return "viewer"
  }

  if (kind === "audio") {
    return "navigate"
  }

  return kind === "text" && item.name.toLowerCase().endsWith(".xml")
    ? "probeXml"
    : "shell"
}
