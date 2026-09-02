import { describe, expect, test } from "bun:test"
import { rangeError } from "./dates"

describe("rangeError", () => {
  test("accepts ordered timed and all-day ranges", () => {
    expect(rangeError("2026-09-03T09:00", "2026-09-03T10:00")).toBeNull()
    expect(rangeError("2026-09-03", "2026-09-03")).toBeNull()
  })

  test("rejects unparseable dates", () => {
    expect(rangeError("", "2026-09-03")).toBe("Start date required")
    expect(rangeError("T09:00", "T10:00")).toBe("Start date required")
    expect(rangeError("2026-09-03", "")).toBe("End date required")
  })

  test("rejects end before start", () => {
    expect(rangeError("2026-09-03T10:00", "2026-09-03T09:00")).toBe(
      "End is before start",
    )
    expect(rangeError("2026-09-04", "2026-09-03")).toBe("End is before start")
  })
})
