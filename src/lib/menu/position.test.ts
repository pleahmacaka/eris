import { describe, expect, test } from "bun:test"
import { placeMenu } from "./position"

const viewport = { left: 0, top: 0, right: 1000, bottom: 800 }
const size = { width: 200, height: 300 }

describe("placeMenu", () => {
  test("opens at the pointer when the menu fits", () => {
    expect(placeMenu({ x: 100, y: 120 }, size, viewport, 8)).toEqual({
      x: 100,
      y: 120,
      origin: "top left",
    })
  })

  test("flips to the left of the pointer near the right edge", () => {
    expect(placeMenu({ x: 950, y: 120 }, size, viewport, 8)).toEqual({
      x: 750,
      y: 120,
      origin: "top right",
    })
  })

  test("flips above the pointer near the bottom edge", () => {
    expect(placeMenu({ x: 100, y: 700 }, size, viewport, 8)).toEqual({
      x: 100,
      y: 400,
      origin: "bottom left",
    })
  })

  test("flips both ways in the bottom right corner", () => {
    expect(placeMenu({ x: 990, y: 790 }, size, viewport, 8)).toEqual({
      x: 790,
      y: 490,
      origin: "bottom right",
    })
  })

  test("clamps inside the margin when neither side has room", () => {
    const tall = { width: 200, height: 700 }
    const placed = placeMenu({ x: 100, y: 400 }, tall, viewport, 8)

    expect(placed.y).toBe(8)
    expect(placed.y + tall.height).toBeLessThanOrEqual(viewport.bottom - 8)
  })

  test("keeps the top left corner visible when the menu is larger than the bounds", () => {
    const huge = { width: 1200, height: 900 }

    expect(placeMenu({ x: 500, y: 400 }, huge, viewport, 8)).toMatchObject({
      x: 8,
      y: 8,
    })
  })

  test("stays below a bounds offset such as a title bar", () => {
    const below = { left: 0, top: 32, right: 1000, bottom: 400 }
    const placed = placeMenu({ x: 100, y: 200 }, size, below, 8)

    expect(placed.y).toBe(40)
    expect(placeMenu({ x: 100, y: 10 }, size, below, 8).y).toBe(40)
  })

  test("keeps every edge inside the bounds for pointers across the viewport", () => {
    for (const x of [0, 250, 500, 750, 1000]) {
      for (const y of [0, 200, 400, 600, 800]) {
        const placed = placeMenu({ x, y }, size, viewport, 8)

        expect(placed.x).toBeGreaterThanOrEqual(8)
        expect(placed.y).toBeGreaterThanOrEqual(8)
        expect(placed.x + size.width).toBeLessThanOrEqual(992)
        expect(placed.y + size.height).toBeLessThanOrEqual(792)
      }
    }
  })
})
