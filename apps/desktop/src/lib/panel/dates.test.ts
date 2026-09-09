import { describe, expect, test } from "bun:test"
import { tr } from "@eris/i18n"
import { rangeError } from "./dates"

const startRequired = tr("panel.errors.startRequired")
const endRequired = tr("panel.errors.endRequired")
const endBeforeStart = tr("panel.errors.endBeforeStart")

describe("rangeError", () => {
  test("accepts ordered timed and all-day ranges", () => {
    expect(rangeError("2026-09-03T09:00", "2026-09-03T10:00")).toBeNull()
    expect(rangeError("2026-09-03", "2026-09-03")).toBeNull()
  })

  test("rejects unparseable dates", () => {
    expect(rangeError("", "2026-09-03")).toBe(startRequired)
    expect(rangeError("T09:00", "T10:00")).toBe(startRequired)
    expect(rangeError("2026-09-03", "")).toBe(endRequired)
  })

  test("rejects end before start", () => {
    expect(rangeError("2026-09-03T10:00", "2026-09-03T09:00")).toBe(
      endBeforeStart,
    )
    expect(rangeError("2026-09-04", "2026-09-03")).toBe(endBeforeStart)
  })
})
