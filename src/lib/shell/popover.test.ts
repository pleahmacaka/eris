import { describe, expect, test } from "bun:test"
import { placeBeside } from "./popover"

const viewport = { width: 1280, height: 800 }
const card = { width: 300, height: 400 }
const GAP = 8

const anchor = (left: number, top: number, width = 40, height = 40) => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
})

describe("placeBeside", () => {
  test("opens to the right of the anchor at its top edge", () => {
    expect(placeBeside(anchor(100, 200), card, viewport, GAP)).toEqual({
      left: 148,
      top: 200,
    })
  })

  test("flips to the left when the right side has no room", () => {
    expect(placeBeside(anchor(1050, 200, 220), card, viewport, GAP)).toEqual({
      left: 742,
      top: 200,
    })
  })

  test("moves up to stay above the bottom edge", () => {
    expect(placeBeside(anchor(100, 700), card, viewport, GAP).top).toBe(392)
  })

  test("stays inside a viewport that is narrower than both sides", () => {
    const narrow = { width: 360, height: 640 }

    expect(placeBeside(anchor(20, 10, 320), card, narrow, GAP)).toEqual({
      left: 52,
      top: 10,
    })
  })

  test("pins to the margin when the card is larger than the viewport", () => {
    const tiny = { width: 280, height: 300 }

    expect(placeBeside(anchor(20, 100), card, tiny, GAP)).toEqual({
      left: 8,
      top: 8,
    })
  })
})
