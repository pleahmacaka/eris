import { expect, test } from "bun:test"
import { stableJson } from "./json"

test("key order does not change the output", () => {
  expect(stableJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } })).toBe(
    stableJson({ a: { c: null, d: [3, { y: 2, z: 1 }] }, b: 1 }),
  )
  expect(stableJson({ a: 1 })).not.toBe(stableJson({ a: 2 }))
})
