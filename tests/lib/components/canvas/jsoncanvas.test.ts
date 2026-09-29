import { describe, expect, test } from "bun:test"
import {
  colorOf,
  parseCanvas,
  serializeCanvas,
} from "../../../../src/lib/components/canvas/jsoncanvas"

const text = (id: string) => ({
  id,
  type: "text",
  text: "메모",
  x: 0,
  y: 0,
  width: 200,
  height: 100,
})

describe("parseCanvas", () => {
  test("reads an empty file as an empty canvas", () => {
    expect(parseCanvas("")?.nodes).toEqual([])
  })

  test("rejects files it cannot understand", () => {
    expect(parseCanvas("{oops")).toBeNull()
    expect(parseCanvas("[]")).toBeNull()
    expect(parseCanvas('{"nodes": 1}')).toBeNull()
  })

  test("keeps invalid nodes and edges aside instead of dropping them", () => {
    const doc = parseCanvas(
      JSON.stringify({
        nodes: [text("a"), text("a"), { id: "b", type: "hologram" }],
        edges: [
          { id: "e1", fromNode: "a", toNode: "a" },
          { id: "e2", fromNode: "a", toNode: "missing" },
        ],
      }),
    )

    expect(doc?.nodes.map(n => n.id)).toEqual(["a"])
    expect(doc?.foreignNodes).toHaveLength(2)
    expect(doc?.edges.map(e => e.id)).toEqual(["e1"])
    expect(doc?.foreignEdges).toHaveLength(1)
  })

  test("writes back unknown fields and set-aside items untouched", () => {
    const source = {
      version: "x",
      nodes: [
        { ...text("a"), extra: { deep: true } },
        { id: "z", type: "?" },
      ],
      edges: [],
    }
    const doc = parseCanvas(JSON.stringify(source))

    expect(doc).not.toBeNull()

    const round = JSON.parse(serializeCanvas(doc as NonNullable<typeof doc>))

    expect(round).toEqual(source)
  })
})

describe("colorOf", () => {
  test("maps presets, passes hex and rejects anything else", () => {
    expect(colorOf("6")).toBe("var(--color-primary)")
    expect(colorOf("#a1b2c3")).toBe("#a1b2c3")
    expect(colorOf("red; background: url(x)")).toBeNull()
    expect(colorOf(3)).toBeNull()
  })
})
