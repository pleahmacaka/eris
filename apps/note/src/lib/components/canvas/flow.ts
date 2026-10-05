import { type Edge, MarkerType, type Node } from "@xyflow/svelte"
import {
  type CanvasDoc,
  type CanvasEdge,
  type CanvasNode,
  colorOf,
  newCanvasId,
  SIDES,
  type Side,
} from "./jsoncanvas"

export type CardData = { node: CanvasNode }

export type CardFlowNode = Node<CardData, "card">

export type CanvasFlowEdge = Edge<{ edge: CanvasEdge }>

const arrow = (color: string | null) =>
  color?.startsWith("#")
    ? { type: MarkerType.ArrowClosed, color }
    : { type: MarkerType.ArrowClosed }

export const toFlowNode = (node: CanvasNode): CardFlowNode => ({
  id: node.id,
  type: "card",
  position: { x: node.x, y: node.y },
  width: node.width,
  height: node.height,
  zIndex: node.type === "group" ? -1 : 0,
  data: { node },
})

export const toFlowEdge = (edge: CanvasEdge): CanvasFlowEdge => {
  const color = colorOf(edge.color)

  return {
    id: edge.id,
    source: edge.fromNode,
    target: edge.toNode,
    sourceHandle: edge.fromSide ?? null,
    targetHandle: edge.toSide ?? null,
    label: edge.label,
    markerStart: edge.fromEnd === "arrow" ? arrow(color) : undefined,
    markerEnd: edge.toEnd === "none" ? undefined : arrow(color),
    style: color ? `stroke: ${color}` : undefined,
    data: { edge },
  }
}

const sideOf = (handle: string | null | undefined): Side | undefined =>
  SIDES.find(side => side === handle)

const withSides = (edge: CanvasEdge, from?: Side, to?: Side) => {
  const { fromSide: _from, toSide: _to, ...rest } = edge

  return {
    ...rest,
    ...(from ? { fromSide: from } : {}),
    ...(to ? { toSide: to } : {}),
  } as CanvasEdge
}

export const fromFlow = (
  doc: CanvasDoc,
  nodes: CardFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasDoc => ({
  ...doc,
  nodes: nodes.map(({ data, position, width, height, measured }) => ({
    ...data.node,
    x: Math.round(position.x),
    y: Math.round(position.y),
    width: Math.round(width ?? measured?.width ?? data.node.width),
    height: Math.round(height ?? measured?.height ?? data.node.height),
  })),
  edges: edges.map(edge =>
    withSides(
      {
        ...(edge.data?.edge ?? { id: edge.id, fromNode: "", toNode: "" }),
        id: edge.id,
        fromNode: edge.source,
        toNode: edge.target,
      },
      sideOf(edge.sourceHandle),
      sideOf(edge.targetHandle),
    ),
  ),
})

export const connectEdge = (connection: {
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
}) =>
  toFlowEdge(
    withSides(
      {
        id: newCanvasId(),
        fromNode: connection.source,
        toNode: connection.target,
      },
      sideOf(connection.sourceHandle),
      sideOf(connection.targetHandle),
    ),
  )
