import { describe, expect, test } from "bun:test"
import { levelOf } from "./meter"

const constant = (value: number) => new Float32Array(256).fill(value)

describe("levelOf", () => {
  test("is zero for silence and for an empty buffer", () => {
    expect(levelOf(constant(0))).toBe(0)
    expect(levelOf(new Float32Array(0))).toBe(0)
  })

  test("is full scale at 0 dBFS and clamps above it", () => {
    expect(levelOf(constant(1))).toBe(1)
    expect(levelOf(constant(2))).toBe(1)
  })

  test("maps decibels linearly between the floor and full scale", () => {
    expect(levelOf(constant(0.001))).toBeCloseTo(0, 5)
    expect(levelOf(constant(0.0316228))).toBeCloseTo(0.5, 4)
    expect(levelOf(constant(0.1))).toBeCloseTo(2 / 3, 5)
  })

  test("uses the RMS of the samples, so the sign does not matter", () => {
    const alternating = Float32Array.from({ length: 256 }, (_, index) =>
      index % 2 === 0 ? 0.1 : -0.1,
    )

    expect(levelOf(alternating)).toBeCloseTo(levelOf(constant(0.1)), 6)
  })

  test("stays below the floor for very quiet input", () => {
    expect(levelOf(constant(0.0001))).toBe(0)
  })
})
