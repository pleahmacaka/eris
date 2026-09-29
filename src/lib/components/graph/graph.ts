import type { SimulationLinkDatum, SimulationNodeDatum } from "d3-force"
import { outgoing } from "../../vault/links"
import { isNote, stem } from "../../vault/paths"

export type GraphNode = SimulationNodeDatum & {
  id: string
  label: string
  degree: number
}

export type GraphLink = SimulationLinkDatum<GraphNode>

export type Graph = {
  key: string
  nodes: GraphNode[]
  links: GraphLink[]
  neighbours: Map<string, Set<string>>
}

export const buildGraph = (
  texts: ReadonlyMap<string, string>,
  paths: readonly string[],
  previous: readonly GraphNode[] = [],
): Graph => {
  const notes = paths.filter(isNote).sort()
  const neighbours = new Map(notes.map(path => [path, new Set<string>()]))
  const pairs: [string, string][] = []

  for (const path of notes) {
    for (const target of outgoing(path, texts.get(path) ?? "", notes)) {
      const mine = neighbours.get(path)

      if (target === path || !mine || mine.has(target)) {
        continue
      }

      mine.add(target)
      neighbours.get(target)?.add(path)
      pairs.push([path, target])
    }
  }

  const placed = new Map(previous.map(node => [node.id, node]))

  const nodes = notes.map(path => {
    const old = placed.get(path)

    return {
      id: path,
      label: stem(path),
      degree: neighbours.get(path)?.size ?? 0,
      x: old?.x,
      y: old?.y,
      vx: old?.vx,
      vy: old?.vy,
    }
  })

  return {
    key: `${notes.join("\n")}\n\n${pairs.map(p => p.join("\n")).join("\n")}`,
    nodes,
    links: pairs.map(([source, target]) => ({ source, target })),
    neighbours,
  }
}

export const radius = (node: GraphNode) => 3 + Math.sqrt(node.degree) * 2
