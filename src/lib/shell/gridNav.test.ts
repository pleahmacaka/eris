import { describe, expect, test } from "bun:test"
import { gridStep } from "./gridNav"

describe("grid step", () => {
  test("moves one cell along a row", () => {
    expect(gridStep("ArrowRight", 4, 9, 3, false)).toBe(5)
    expect(gridStep("ArrowLeft", 4, 9, 3, false)).toBe(3)
  })

  test("mirrors the row direction for right-to-left layouts", () => {
    expect(gridStep("ArrowRight", 4, 9, 3, true)).toBe(3)
    expect(gridStep("ArrowLeft", 4, 9, 3, true)).toBe(5)
  })

  test("moves one row along a column", () => {
    expect(gridStep("ArrowDown", 1, 9, 3, false)).toBe(4)
    expect(gridStep("ArrowUp", 7, 9, 3, false)).toBe(4)
    expect(gridStep("ArrowDown", 1, 9, 2, false)).toBe(3)
  })

  test("stays in place at an edge", () => {
    expect(gridStep("ArrowLeft", 0, 9, 3, false)).toBe(0)
    expect(gridStep("ArrowRight", 8, 9, 3, false)).toBe(8)
    expect(gridStep("ArrowUp", 2, 9, 3, false)).toBe(2)
    expect(gridStep("ArrowDown", 7, 8, 3, false)).toBe(7)
  })

  test("jumps to either end", () => {
    expect(gridStep("Home", 5, 9, 3, false)).toBe(0)
    expect(gridStep("End", 5, 9, 3, false)).toBe(8)
  })

  test("ignores other keys", () => {
    expect(gridStep("Enter", 5, 9, 3, false)).toBeNull()
    expect(gridStep("a", 5, 9, 3, false)).toBeNull()
  })
})
