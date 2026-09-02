import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import {
  eventsOn,
  formatRange,
  parseDay,
  parseQuickEvent,
  upcoming,
} from "./calendar"
import type { CalendarEvent } from "./types"

const now = new Date(2026, 8, 2, 10, 0)

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "e",
  title: "e",
  notes: "",
  start: "2026-09-02T09:00",
  end: "2026-09-02T10:00",
  allDay: false,
  color: null,
  reminderMinutes: null,
  recurrence: "none",
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const on = (events: CalendarEvent[], day: string) =>
  eventsOn(events, new Date(`${day}T12:00`))

describe("recurring all-day events across DST (America/New_York)", () => {
  const originalTz = process.env.TZ

  beforeAll(() => {
    process.env.TZ = "America/New_York"
  })

  afterAll(() => {
    process.env.TZ = originalTz
  })

  test("spring forward: occurrence does not leak into the next day", () => {
    const list = [
      event({
        allDay: true,
        recurrence: "daily",
        start: "2026-03-07",
        end: "2026-03-07",
      }),
    ]

    const hits = on(list, "2026-03-09")

    expect(hits.map(e => `${e.start}..${e.end}`)).toEqual([
      "2026-03-09..2026-03-09",
    ])
  })

  test("fall back: occurrence end is not before its start", () => {
    const list = [
      event({
        allDay: true,
        recurrence: "weekly",
        start: "2026-10-25",
        end: "2026-10-25",
      }),
    ]

    const [hit] = on(list, "2026-11-01")

    expect(hit.end).toBe("2026-11-01")
    expect(formatRange(hit)).toBe("All day")
  })

  test("weekly timed event keeps its wall-clock slot across DST", () => {
    const list = [
      event({
        recurrence: "weekly",
        start: "2026-01-05T09:00",
        end: "2026-01-05T10:00",
      }),
    ]

    const from = new Date(2026, 3, 6, 0, 0)

    expect(upcoming(list, from, 7).map(e => e.start)).toEqual([
      "2026-04-06T09:00",
    ])
  })
})

describe("recurring event with an unparsable start", () => {
  test("occurrences terminates", async () => {
    const dir = import.meta.dir.replaceAll("\\", "/")
    const code = `
      import { eventsOn } from "${dir}/calendar.ts"
      const bad = {
        id: "x", title: "x", notes: "", start: "", end: "",
        allDay: false, color: null, reminderMinutes: null,
        recurrence: "daily", createdAt: 0, updatedAt: 0,
      }
      eventsOn([bad], new Date())
      console.log("done")
    `
    const proc = Bun.spawn(["bun", "-e", code], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const outcome = await Promise.race([
      proc.exited.then(code => ({ code })),
      Bun.sleep(4000).then(() => ({ code: "timeout" as const })),
    ])

    proc.kill()

    expect(outcome.code).toBe(0)
  })
})

describe("parseDay validates its fields", () => {
  test("rejects impossible calendar dates", () => {
    expect(parseDay("2026-02-31", now)).toBeNull()
    expect(parseDay("2026-13-01", now)).toBeNull()
  })

  test("does not turn a US-style date into a year-1917 due date", () => {
    expect(parseDay("10-20-2026", now)).toBeNull()
  })
})

describe("time range crossing midnight", () => {
  test("22:00-02:00 ends at two the next morning", () => {
    expect(parseQuickEvent("Party 22:00-02:00", now)).toMatchObject({
      start: "2026-09-02T22:00",
      end: "2026-09-03T02:00",
    })
  })
})
