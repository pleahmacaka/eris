export const SIDES = ["top", "right", "bottom", "left"] as const

export type Side = (typeof SIDES)[number]

type Fields = Record<string, unknown>

type Box = Fields & {
  id: string
  x: number
  y: number
  width: number
  height: number
  color?: string
}

export type TextNode = Box & { type: "text"; text: string }

export type FileNode = Box & { type: "file"; file: string }

export type LinkNode = Box & { type: "link"; url: string }

export type GroupNode = Box & { type: "group"; label?: string }

export type CanvasNode = TextNode | FileNode | LinkNode | GroupNode

export type CanvasEdge = Fields & {
  id: string
  fromNode: string
  toNode: string
  fromSide?: Side
  toSide?: Side
  fromEnd?: "none" | "arrow"
  toEnd?: "none" | "arrow"
  color?: string
  label?: string
}

export type CanvasDoc = {
  rest: Fields
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  foreignNodes: unknown[]
  foreignEdges: unknown[]
}

const PRESETS: Record<string, string> = {
  "1": "var(--color-error)",
  "2": "oklch(72% 0.17 50)",
  "3": "var(--color-warning)",
  "4": "var(--color-success)",
  "5": "var(--color-info)",
  "6": "var(--color-primary)",
}

const HEX = /^#[0-9a-f]{3,8}$/i

export const colorOf = (color: unknown) => {
  if (typeof color !== "string") {
    return null
  }

  return PRESETS[color] ?? (HEX.test(color) ? color : null)
}

const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isText = (value: unknown): value is string =>
  typeof value === "string" && value !== ""

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const isOptional = (value: unknown, check: (v: unknown) => boolean) =>
  value === undefined || check(value)

const isSide = (value: unknown) => SIDES.includes(value as Side)

const isEnd = (value: unknown) => value === "none" || value === "arrow"

const isNode = (value: unknown): value is CanvasNode => {
  if (
    !isObject(value) ||
    !isText(value.id) ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    !isFiniteNumber(value.width) ||
    !isFiniteNumber(value.height) ||
    !isOptional(value.color, v => typeof v === "string")
  ) {
    return false
  }

  switch (value.type) {
    case "text":
      return typeof value.text === "string"
    case "file":
      return isText(value.file)
    case "link":
      return typeof value.url === "string"
    case "group":
      return isOptional(value.label, v => typeof v === "string")
    default:
      return false
  }
}

const isEdge = (value: unknown, known: Set<string>): value is CanvasEdge =>
  isObject(value) &&
  isText(value.id) &&
  isText(value.fromNode) &&
  isText(value.toNode) &&
  known.has(value.fromNode) &&
  known.has(value.toNode) &&
  isOptional(value.fromSide, isSide) &&
  isOptional(value.toSide, isSide) &&
  isOptional(value.fromEnd, isEnd) &&
  isOptional(value.toEnd, isEnd) &&
  isOptional(value.color, v => typeof v === "string") &&
  isOptional(value.label, v => typeof v === "string")

const listOf = (value: unknown) =>
  value === undefined ? [] : Array.isArray(value) ? value : null

export const parseCanvas = (text: string): CanvasDoc | null => {
  if (text.trim() === "") {
    return {
      rest: {},
      nodes: [],
      edges: [],
      foreignNodes: [],
      foreignEdges: [],
    }
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (!isObject(parsed)) {
    return null
  }

  const { nodes: rawNodes, edges: rawEdges, ...rest } = parsed
  const nodeList = listOf(rawNodes)
  const edgeList = listOf(rawEdges)

  if (!nodeList || !edgeList) {
    return null
  }

  const doc: CanvasDoc = {
    rest,
    nodes: [],
    edges: [],
    foreignNodes: [],
    foreignEdges: [],
  }
  const known = new Set<string>()

  for (const node of nodeList) {
    if (isNode(node) && !known.has(node.id)) {
      known.add(node.id)
      doc.nodes.push(node)
    } else {
      doc.foreignNodes.push(node)
    }
  }

  const edgeIds = new Set<string>()

  for (const edge of edgeList) {
    if (isEdge(edge, known) && !edgeIds.has(edge.id)) {
      edgeIds.add(edge.id)
      doc.edges.push(edge)
    } else {
      doc.foreignEdges.push(edge)
    }
  }

  return doc
}

export const serializeCanvas = (doc: CanvasDoc) =>
  `${JSON.stringify(
    {
      ...doc.rest,
      nodes: [...doc.nodes, ...doc.foreignNodes],
      edges: [...doc.edges, ...doc.foreignEdges],
    },
    null,
    "\t",
  )}\n`

export const newCanvasId = () =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 16)
