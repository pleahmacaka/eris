export type Pane = {
  id: number
  shell: string
  cwd: string | null
  title: string
  name?: string
  pty: number | null
}

export type Split = {
  id: number
  dir: "row" | "column"
  children: Layout[]
  sizes: number[]
}

export type Layout = Pane | Split

export type Side = "left" | "right" | "top" | "bottom"

export type Rect = { x: number; y: number; w: number; h: number }

export type Divider = {
  split: Split
  index: number
  rect: Rect
  at: number
  start: number
  span: number
}

let next = 1

export const newId = () => next++

export const isSplit = (node: Layout): node is Split => "children" in node

export const panesOf = (node: Layout): Pane[] =>
  isSplit(node) ? node.children.flatMap(panesOf) : [node]

export const renumber = (node: Layout): Layout =>
  isSplit(node)
    ? { ...node, id: newId(), children: node.children.map(renumber) }
    : { ...node, id: newId() }

export const mapPanes = (node: Layout, swap: (pane: Pane) => Layout): Layout =>
  isSplit(node)
    ? { ...node, children: node.children.map(child => mapPanes(child, swap)) }
    : swap(node)

const directionOf = (side: Side) =>
  side === "left" || side === "right" ? "row" : "column"

const leading = (side: Side) => side === "left" || side === "top"

export const insert = (
  node: Layout,
  target: number,
  side: Side,
  added: Layout,
): Layout => {
  const dir = directionOf(side)

  if (!isSplit(node)) {
    if (node.id !== target) {
      return node
    }

    return {
      id: newId(),
      dir,
      children: leading(side) ? [added, node] : [node, added],
      sizes: [1, 1],
    }
  }

  const at = node.children.findIndex(
    child => !isSplit(child) && child.id === target,
  )

  if (at >= 0 && node.dir === dir) {
    const children = [...node.children]
    const sizes = [...node.sizes]
    const half = sizes[at] / 2

    children.splice(leading(side) ? at : at + 1, 0, added)
    sizes.splice(at, 1, half, half)

    return { ...node, children, sizes }
  }

  return {
    ...node,
    children: node.children.map(child => insert(child, target, side, added)),
  }
}

export const remove = (node: Layout, id: number): Layout | null => {
  if (!isSplit(node)) {
    return node.id === id ? null : node
  }

  const kept = node.children.flatMap((child, index) => {
    const left = remove(child, id)

    return left ? [{ child: left, size: node.sizes[index] }] : []
  })

  if (kept.length <= 1) {
    return kept[0]?.child ?? null
  }

  return {
    ...node,
    children: kept.map(entry => entry.child),
    sizes: kept.map(entry => entry.size),
  }
}

export const place = (
  node: Layout,
  rect: Rect = { x: 0, y: 0, w: 1, h: 1 },
  found = {
    panes: [] as { pane: Pane; rect: Rect }[],
    dividers: [] as Divider[],
  },
) => {
  if (!isSplit(node)) {
    found.panes.push({ pane: node, rect })

    return found
  }

  const total = node.sizes.reduce((sum, size) => sum + size, 0)
  const row = node.dir === "row"
  let offset = 0

  node.children.forEach((child, index) => {
    const share = node.sizes[index] / total
    const box = row
      ? { x: rect.x + offset * rect.w, y: rect.y, w: share * rect.w, h: rect.h }
      : { x: rect.x, y: rect.y + offset * rect.h, w: rect.w, h: share * rect.h }

    if (index > 0) {
      const previous = node.sizes[index - 1] / total

      found.dividers.push({
        split: node,
        index: index - 1,
        rect,
        at: offset,
        start: offset - previous,
        span: previous + share,
      })
    }

    place(child, box, found)
    offset += share
  })

  return found
}

export const sideAt = (x: number, y: number): Side | "center" => {
  const edges: [Side, number][] = [
    ["left", x],
    ["right", 1 - x],
    ["top", y],
    ["bottom", 1 - y],
  ]
  const [side, distance] = edges.reduce((best, edge) =>
    edge[1] < best[1] ? edge : best,
  )

  return distance < 0.3 ? side : "center"
}

export const neighbor = (
  node: Layout,
  from: number,
  key: "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown",
) => {
  const placed = place(node).panes
  const origin = placed.find(entry => entry.pane.id === from)

  if (!origin) {
    return null
  }

  const center = (rect: Rect) => ({
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
  })
  const here = center(origin.rect)
  const near = 1e-6
  const ahead = (rect: Rect) => {
    switch (key) {
      case "ArrowLeft":
        return rect.x + rect.w <= origin.rect.x + near
      case "ArrowRight":
        return rect.x >= origin.rect.x + origin.rect.w - near
      case "ArrowUp":
        return rect.y + rect.h <= origin.rect.y + near
      case "ArrowDown":
        return rect.y >= origin.rect.y + origin.rect.h - near
    }
  }

  const candidates = placed
    .filter(entry => entry.pane.id !== from && ahead(entry.rect))
    .map(entry => {
      const there = center(entry.rect)

      return {
        pane: entry.pane,
        score: Math.abs(there.x - here.x) + Math.abs(there.y - here.y),
      }
    })

  candidates.sort((a, b) => a.score - b.score)

  return candidates[0]?.pane ?? null
}
