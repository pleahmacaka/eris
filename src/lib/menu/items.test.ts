import { describe, expect, test } from "bun:test"
import { type MenuItem, menuRows, navigate, stepItem } from "./items"

const item = (id: string, disabled = false): MenuItem => ({
  id,
  label: { key: "menu.copy" },
  icon: "lucide:copy",
  disabled,
  run: () => undefined,
})

describe("menuRows", () => {
  test("numbers items across sections and separates non-empty sections", () => {
    const rows = menuRows([[item("a"), item("b")], [], [item("c")]])

    expect(
      rows.map(row => (row.kind === "item" ? row.item.id : "separator")),
    ).toEqual(["a", "b", "separator", "c"])
    expect(
      rows.flatMap(row => (row.kind === "item" ? [row.index] : [])),
    ).toEqual([0, 1, 2])
  })

  test("never starts or ends with a separator", () => {
    expect(menuRows([[], [item("a")], []]).map(row => row.kind)).toEqual([
      "item",
    ])
    expect(menuRows([[], []])).toEqual([])
  })

  test("gives every separator its own key", () => {
    const keys = menuRows([[item("a")], [item("b")], [item("c")]]).flatMap(
      row => (row.kind === "separator" ? [row.key] : []),
    )

    expect(new Set(keys).size).toBe(2)
  })
})

describe("stepItem", () => {
  const items = [item("a"), item("b", true), item("c"), item("d", true)]

  test("skips disabled items and wraps around", () => {
    expect(stepItem(items, 0, 1)).toBe(2)
    expect(stepItem(items, 2, 1)).toBe(0)
    expect(stepItem(items, 0, -1)).toBe(2)
  })

  test("enters from the matching edge when nothing is active", () => {
    expect(stepItem(items, -1, 1)).toBe(0)
    expect(stepItem(items, -1, -1)).toBe(2)
  })

  test("reports no target when every item is disabled", () => {
    expect(stepItem([item("a", true)], -1, 1)).toBe(-1)
    expect(stepItem([], -1, 1)).toBe(-1)
  })
})

describe("navigate", () => {
  const items = [item("a"), item("b"), item("c", true)]

  test("moves with the arrow keys", () => {
    expect(navigate(items, 0, "ArrowDown")).toBe(1)
    expect(navigate(items, 0, "ArrowUp")).toBe(1)
  })

  test("jumps to the first and last enabled item", () => {
    expect(navigate(items, 1, "Home")).toBe(0)
    expect(navigate(items, 0, "End")).toBe(1)
    expect(navigate(items, 1, "PageUp")).toBe(0)
    expect(navigate(items, 0, "PageDown")).toBe(1)
  })

  test("ignores keys that do not move the highlight", () => {
    expect(navigate(items, 0, "Enter")).toBeNull()
    expect(navigate(items, 0, "a")).toBeNull()
  })
})
