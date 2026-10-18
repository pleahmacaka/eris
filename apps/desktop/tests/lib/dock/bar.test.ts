import { expect, test } from "bun:test"
import { barHeightFor } from "../../../src/lib/dock/bar"

test("islands reserve their inset above and below the configured height", () => {
  expect(barHeightFor(56, false)).toBe(56)
  expect(barHeightFor(56, true)).toBe(64)
})
