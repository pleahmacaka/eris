import type { Section } from "../../groups"
import type { Item } from "../../items"
import type { ViewMode } from "../../store/prefs.svelte"

type Flow = "rows" | "grid" | "columns"

export type Layout = {
  width: number
  height: number
  icon: number
  flow: Flow
}

export type Line = {
  key: string
  start: number
  size: number
  section: Section | null
  items: Item[]
}

export type Plan = {
  lines: Line[]
  lineOf: Map<string, number>
  total: number
}

type Box = { left: number; top: number; width: number; height: number }

const LAYOUTS: Record<ViewMode, Layout> = {
  details: { width: 0, height: 1.875, icon: 1, flow: "rows" },
  list: { width: 16, height: 1.75, icon: 1, flow: "columns" },
  small: { width: 14, height: 1.75, icon: 1, flow: "grid" },
  tiles: { width: 17.5, height: 4.5, icon: 3, flow: "grid" },
  medium: { width: 6.5, height: 7, icon: 3, flow: "grid" },
  large: { width: 9.5, height: 10.25, icon: 6, flow: "grid" },
}

export const HEADER = 2

const GROUP = 2.25

export const layoutOf = (view: ViewMode, grouped: boolean): Layout => {
  const base = LAYOUTS[view]

  return grouped && base.flow === "columns" ? { ...base, flow: "grid" } : base
}

export const perLineOf = (
  layout: Layout,
  width: number,
  height: number,
  rem: number,
) => {
  if (layout.flow === "rows") {
    return 1
  }

  const room = layout.flow === "grid" ? width : height
  const size = layout.flow === "grid" ? layout.width : layout.height

  return Math.max(1, Math.floor(room / (size * rem)))
}

export const lineSize = (layout: Layout) =>
  layout.flow === "columns" ? layout.width : layout.height

export const planOf = (
  items: Item[],
  sections: Section[] | null,
  layout: Layout,
  perLine: number,
): Plan => {
  const lines: Line[] = []
  const lineOf = new Map<string, number>()
  const size = lineSize(layout)
  let start = 0

  for (const section of sections ?? [{ id: "", label: "", items }]) {
    if (sections) {
      lines.push({
        key: `#${section.id}`,
        start,
        size: GROUP,
        section,
        items: [],
      })
      start += GROUP
    }

    for (let at = 0; at < section.items.length; at += perLine) {
      const chunk = section.items.slice(at, at + perLine)

      for (const item of chunk) {
        lineOf.set(item.key, lines.length)
      }

      lines.push({
        key: chunk[0].key,
        start,
        size,
        section: null,
        items: chunk,
      })
      start += size
    }
  }

  return { lines, lineOf, total: start }
}

export const lineAt = (lines: Line[], at: number) => {
  let low = 0
  let high = lines.length

  while (low < high) {
    const middle = (low + high) >> 1
    const line = lines[middle]

    if (line.start + line.size <= at) {
      low = middle + 1
    } else {
      high = middle
    }
  }

  return low
}

export const stepsOf = (
  layout: Layout,
  perLine: number,
  page: number,
): Record<string, number> => {
  const { flow } = layout
  const down = flow === "grid" ? perLine : 1
  const across = flow === "columns" ? perLine : flow === "grid" ? 1 : 0

  return {
    ArrowDown: flow === "columns" ? 1 : down,
    ArrowUp: flow === "columns" ? -1 : -down,
    ArrowRight: across,
    ArrowLeft: -across,
    PageDown: page,
    PageUp: -page,
  }
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.left + b.width &&
  a.left + a.width > b.left &&
  a.top < b.top + b.height &&
  a.top + a.height > b.top

export const hitsOf = (
  plan: Plan,
  layout: Layout,
  area: Box,
  rem: number,
  header: number,
  rowWidth: number,
) => {
  const columns = layout.flow === "columns"
  const offset = columns ? 0 : header * rem
  const near = (columns ? area.left : area.top - offset) / rem
  const far =
    (columns ? area.left + area.width : area.top + area.height - offset) / rem
  const cellWidth = (layout.flow === "rows" ? rowWidth : layout.width) * rem
  const cellHeight = layout.height * rem
  const found: string[] = []

  for (
    let index = lineAt(plan.lines, near);
    index < plan.lines.length;
    index++
  ) {
    const line = plan.lines[index]

    if (line.start >= far) {
      break
    }

    line.items.forEach((item, at) => {
      const box = columns
        ? {
            left: line.start * rem,
            top: at * cellHeight,
            width: cellWidth,
            height: cellHeight,
          }
        : {
            left: at * cellWidth,
            top: offset + line.start * rem,
            width: cellWidth,
            height: cellHeight,
          }

      if (overlaps(box, area)) {
        found.push(item.key)
      }
    })
  }

  return found
}
