import { collator } from "../format"
import { byDate, byKind, byOrder, type Section } from "../groups"
import type { Item } from "../items"
import { HIDDEN, SYSTEM } from "../locations"
import type { FolderView } from "./prefs.svelte"

export type Arranged = { items: Item[]; sections: Section[] | null }

type Placement = {
  showHidden: boolean
  locale: string
  sectionOf: ((item: Item) => string) | null
}

const THIS_PC_SECTIONS = ["folders", "drives", "network", "linux"]

const shown = (item: Item, showHidden: boolean) => {
  const hidden = (item.attrs & HIDDEN) !== 0
  const protectedFile = hidden && (item.attrs & SYSTEM) !== 0

  return !protectedFile && (showHidden || !hidden)
}

export const arrange = (
  source: Item[],
  rule: FolderView,
  { showHidden, locale, sectionOf }: Placement,
): Arranged => {
  const rows = source.filter(item => shown(item, showHidden))

  if (sectionOf) {
    const sections = byOrder(rows, THIS_PC_SECTIONS, sectionOf)

    return { items: sections.flatMap(section => section.items), sections }
  }

  const compare = collator(locale).compare
  const { sort: key, ascending, group } = rule
  const direction = ascending ? 1 : -1

  const sorted = rows.sort((a, b) => {
    if (a.dir !== b.dir) {
      return a.dir ? -1 : 1
    }

    let difference = 0

    if (key === "modified") {
      difference = a.modified - b.modified
    } else if (key === "size") {
      difference = a.size - b.size
    } else if (key === "kind") {
      difference = compare(a.kind, b.kind)
    }

    return (difference || compare(a.name, b.name)) * direction
  })

  if (group === "none") {
    return { items: sorted, sections: null }
  }

  const sections =
    group === "modified"
      ? byDate(sorted, key !== "modified" || !ascending)
      : byKind(sorted, key !== "kind" || ascending)

  return { items: sections.flatMap(section => section.items), sections }
}
