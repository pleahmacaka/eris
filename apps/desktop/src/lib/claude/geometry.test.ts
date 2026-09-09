import { describe, expect, test } from "bun:test"
import { clamp, layoutOf, monitorAt, px, settleAt, sizesOf } from "./geometry"

const left = { x: 0, y: 0, width: 1000, height: 800 }
const right = { x: 1000, y: 0, width: 1000, height: 800 }
const whole = { x: 0, y: 0, width: 2000, height: 800 }

describe("px and sizes", () => {
  test("rounds rem to whole pixels", () => {
    expect(px(3.5, 16)).toBe(56)
    expect(px(0.375, 16)).toBe(6)
    expect(px(0.2, 16)).toBe(3)
  })

  test("step is bubble plus gap", () => {
    const sizes = sizesOf(16)

    expect(sizes.step).toBe(sizes.bubble + sizes.stackGap)
    expect(sizes.panelWidth).toBe(440)
  })

  test("clamp keeps max when min exceeds it", () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-1, 0, 10)).toBe(0)
    expect(clamp(50, 20, 10)).toBe(10)
  })
})

describe("monitorAt", () => {
  test("picks the monitor under the point", () => {
    expect(monitorAt([left, right], 1500, 100, whole)).toBe(right)
  })

  test("falls back to the nearest center off screen", () => {
    expect(monitorAt([left, right], 2500, 100, whole)).toBe(right)
    expect(monitorAt([left, right], -50, 100, whole)).toBe(left)
  })

  test("uses the fallback without monitors", () => {
    expect(monitorAt([], 10, 10, whole)).toBe(whole)
  })
})

describe("layoutOf", () => {
  test("stacks members below the head", () => {
    const layout = layoutOf(
      [
        { id: "a", stack: "s", left: 10, top: 20 },
        { id: "b", stack: "s", left: 99, top: 99 },
        { id: "c", stack: "t", left: 5, top: 6 },
      ],
      62,
    )

    expect(layout.get("a")).toEqual({ left: 10, top: 20 })
    expect(layout.get("b")).toEqual({ left: 10, top: 82 })
    expect(layout.get("c")).toEqual({ left: 5, top: 6 })
  })
})

describe("settleAt", () => {
  const options = {
    monitors: [left, right],
    fallback: whole,
    snap: 0.15,
    bubble: 56,
    edge: 8,
  }

  test("snaps to the edge inside the band", () => {
    const out = settleAt({ left: 20, top: 700 }, 56, options)

    expect(out.left).toBe(8)
    expect(out.top).toBe(800 - 56 - 8)
    expect(out.corner).toEqual({ right: false, bottom: true })
  })

  test("floats freely outside the band", () => {
    const out = settleAt({ left: 400, top: 300 }, 56, options)

    expect(out).toEqual({
      left: 400,
      top: 300,
      corner: { right: false, bottom: false },
    })
  })

  test("clamps a stack taller than the space left", () => {
    const out = settleAt({ left: 1500, top: 780 }, 300, options)

    expect(out.top).toBe(800 - 300 - 8)
    expect(out.corner.right).toBe(true)
  })
})
