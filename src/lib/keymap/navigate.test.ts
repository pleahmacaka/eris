import { describe, expect, test } from "bun:test"
import { walk } from "./navigate"

const ROOMS = ["a", "b", "c", "d"]

describe("walk", () => {
  test("lists the other items in travel order and wraps around", () => {
    expect(walk(ROOMS, 1, 1)).toEqual(["c", "d", "a"])
    expect(walk(ROOMS, 1, -1)).toEqual(["a", "d", "c"])
    expect(walk(ROOMS, 3, 1)).toEqual(["a", "b", "c"])
    expect(walk(ROOMS, 0, -1)).toEqual(["d", "c", "b"])
  })

  test("starts from an end when nothing is selected", () => {
    expect(walk(ROOMS, -1, 1)).toEqual(["a", "b", "c", "d"])
    expect(walk(ROOMS, -1, -1)).toEqual(["d", "c", "b", "a"])
  })

  test("has nowhere to go in a list of one or none", () => {
    expect(walk(["a"], 0, 1)).toEqual([])
    expect(walk(["a"], -1, -1)).toEqual(["a"])
    expect(walk([], -1, 1)).toEqual([])
  })
})
