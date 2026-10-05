import { expect, test } from "bun:test"
import { buildGraph } from "../../../../src/lib/components/graph/graph"

const paths = ["a.md", "b.md", "c.md", "board.canvas"]

test("every note is a node, orphans included, canvases excluded", () => {
  const graph = buildGraph(new Map(), paths)

  expect(graph.nodes.map(n => n.id)).toEqual(["a.md", "b.md", "c.md"])
  expect(graph.links).toEqual([])
})

test("links are undirected, deduplicated and never self-referencing", () => {
  const texts = new Map([
    ["a.md", "[[b]] [[b]] [[a]]"],
    ["b.md", "[[a]] [[c]]"],
  ])
  const graph = buildGraph(texts, paths)

  expect(graph.links).toEqual([
    { source: "a.md", target: "b.md" },
    { source: "b.md", target: "c.md" },
  ])
  expect(graph.nodes.find(n => n.id === "b.md")?.degree).toBe(2)
  expect([...(graph.neighbours.get("a.md") ?? [])]).toEqual(["b.md"])
})

test("rebuilding keeps node positions and the key only tracks structure", () => {
  const texts = new Map([["a.md", "[[b]]"]])
  const first = buildGraph(texts, paths)

  first.nodes[0].x = 42
  first.nodes[0].y = 7

  const second = buildGraph(
    new Map([["a.md", "[[b]] 추가 문장"]]),
    paths,
    first.nodes,
  )

  expect(second.nodes[0]).toMatchObject({ x: 42, y: 7 })
  expect(second.key).toBe(first.key)
})
