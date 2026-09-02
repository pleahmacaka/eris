import { describe, expect, test } from "bun:test"
import { dateTimeKey } from "./calendar"
import { fromIcs, toIcs } from "./ics"
import type { CalendarEvent } from "./types"

const stamp = Date.UTC(2026, 0, 2, 3, 4, 5)

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "e1",
  title: "Standup",
  notes: "",
  start: "2026-09-02T09:00",
  end: "2026-09-02T10:00",
  allDay: false,
  color: null,
  reminderMinutes: null,
  recurrence: "none",
  createdAt: stamp,
  updatedAt: stamp,
  ...over,
})

const wrap = (body: string) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", body, "END:VCALENDAR"].join("\r\n")

const vevent = (...lines: string[]) =>
  wrap(["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n"))

const octets = (line: string) => new TextEncoder().encode(line).length

const value = (text: string, name: string) =>
  text
    .split("\r\n")
    .find(line => line.startsWith(`${name}:`) || line.startsWith(`${name};`))

describe("toIcs", () => {
  test("wraps events in a calendar with CRLF endings", () => {
    const text = toIcs([event()])

    expect(text.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true)
    expect(text.endsWith("END:VCALENDAR\r\n")).toBe(true)
    expect(text).toContain("\r\nBEGIN:VEVENT\r\n")
    expect(value(text, "UID")).toBe("UID:e1@eris")
    expect(value(text, "DTSTART")).toBe("DTSTART:20260902T090000")
    expect(value(text, "DTEND")).toBe("DTEND:20260902T100000")
    expect(value(text, "DTSTAMP")).toBe("DTSTAMP:20260102T030405Z")
  })

  test("writes all-day events as exclusive date ranges", () => {
    const text = toIcs([
      event({ allDay: true, start: "2026-09-02", end: "2026-09-03" }),
    ])

    expect(value(text, "DTSTART")).toBe("DTSTART;VALUE=DATE:20260902")
    expect(value(text, "DTEND")).toBe("DTEND;VALUE=DATE:20260904")
  })

  test("escapes commas, semicolons, backslashes and newlines", () => {
    const text = toIcs([
      event({ title: "Tea, cake; c:\\eris", notes: "one\ntwo" }),
    ])

    expect(text).toContain("SUMMARY:Tea\\, cake\\; c:\\\\eris")
    expect(text).toContain("DESCRIPTION:one\\ntwo")
  })

  test("folds long lines at 75 octets with a leading space", () => {
    const text = toIcs([event({ title: "가".repeat(90) })])
    const lines = text.split("\r\n").filter(Boolean)

    expect(lines.every(line => octets(line) <= 75)).toBe(true)
    expect(lines.filter(line => line.startsWith(" ")).length).toBeGreaterThan(0)
    expect(fromIcs(text)[0].title).toBe("가".repeat(90))
  })

  test("maps recurrence and reminders", () => {
    const text = toIcs([event({ recurrence: "weekdays", reminderMinutes: 15 })])

    expect(value(text, "RRULE")).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")
    expect(text).toContain("BEGIN:VALARM")
    expect(value(text, "TRIGGER")).toBe("TRIGGER:-PT15M")
  })
})

describe("fromIcs", () => {
  test("converts UTC stamps to local wall time", () => {
    const [parsed] = fromIcs(
      vevent("UID:a", "SUMMARY:Sync", "DTSTART:20260902T090000Z"),
    )

    expect(parsed.start).toBe(dateTimeKey(new Date(Date.UTC(2026, 8, 2, 9))))
    expect(parsed.allDay).toBe(false)
  })

  test("keeps floating times as local", () => {
    const [parsed] = fromIcs(
      vevent(
        "UID:a",
        "SUMMARY:Sync",
        "DTSTART:20260902T090000",
        "DTEND:20260902T103000",
      ),
    )

    expect(parsed.start).toBe("2026-09-02T09:00")
    expect(parsed.end).toBe("2026-09-02T10:30")
  })

  test("converts a zoned start to local wall time", () => {
    const [parsed] = fromIcs(
      vevent(
        "UID:a",
        "SUMMARY:Sync",
        "DTSTART;TZID=America/New_York:20260315T090000",
      ),
    )

    expect(parsed.start).toBe(dateTimeKey(new Date(Date.UTC(2026, 2, 15, 13))))
  })

  test("keeps an unknown zone floating", () => {
    const [parsed] = fromIcs(
      vevent(
        "UID:a",
        "SUMMARY:Sync",
        "DTSTART;TZID=Eastern Standard Time:20260902T090000",
      ),
    )

    expect(parsed.start).toBe("2026-09-02T09:00")
  })

  test("reads DURATION when DTEND is missing", () => {
    const [meeting] = fromIcs(
      vevent(
        "UID:a",
        "SUMMARY:Sync",
        "DTSTART:20260902T090000",
        "DURATION:PT30M",
      ),
    )
    const [trip] = fromIcs(
      vevent(
        "UID:b",
        "SUMMARY:Trip",
        "DTSTART;VALUE=DATE:20260902",
        "DURATION:P3D",
      ),
    )
    const [dated] = fromIcs(
      vevent(
        "UID:c",
        "SUMMARY:Sync",
        "DTSTART:20260902T090000",
        "DTEND:20260902T093000",
        "DURATION:PT4H",
      ),
    )

    expect(meeting.end).toBe("2026-09-02T09:30")
    expect(trip.end).toBe("2026-09-04")
    expect(dated.end).toBe("2026-09-02T09:30")
  })

  test("reads all-day ranges back as inclusive dates", () => {
    const [parsed] = fromIcs(
      vevent(
        "UID:a",
        "SUMMARY:Trip",
        "DTSTART;VALUE=DATE:20260902",
        "DTEND;VALUE=DATE:20260905",
      ),
    )

    expect(parsed.allDay).toBe(true)
    expect(parsed.start).toBe("2026-09-02")
    expect(parsed.end).toBe("2026-09-04")
  })

  test("maps FREQ and weekday rules", () => {
    const rule = (text: string) =>
      fromIcs(
        vevent("SUMMARY:R", "DTSTART:20260902T090000", `RRULE:${text}`),
      )[0].recurrence

    expect(rule("FREQ=DAILY")).toBe("daily")
    expect(rule("FREQ=WEEKLY")).toBe("weekly")
    expect(rule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")).toBe("weekdays")
    expect(rule("FREQ=WEEKLY;BYDAY=MO,WE")).toBe("weekly")
    expect(rule("FREQ=MONTHLY")).toBe("monthly")
    expect(rule("FREQ=YEARLY")).toBe("yearly")
    expect(rule("FREQ=SECONDLY")).toBe("none")
  })

  test("reads alarm triggers as reminder minutes", () => {
    const reminder = (trigger: string) =>
      fromIcs(
        vevent(
          "SUMMARY:R",
          "DTSTART:20260902T090000",
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `TRIGGER:${trigger}`,
          "END:VALARM",
        ),
      )[0].reminderMinutes

    expect(reminder("-PT15M")).toBe(15)
    expect(reminder("PT0S")).toBe(0)
    expect(reminder("-P1D")).toBe(1440)
    expect(reminder("-PT1H30M")).toBe(90)
  })

  test("takes the first display alarm and ignores end-relative triggers", () => {
    const alarm = (...lines: string[]) =>
      fromIcs(vevent("SUMMARY:R", "DTSTART:20260902T090000", ...lines))[0]
        .reminderMinutes

    expect(
      alarm(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-PT30M",
        "END:VALARM",
        "BEGIN:VALARM",
        "ACTION:EMAIL",
        "TRIGGER:-P1D",
        "END:VALARM",
      ),
    ).toBe(30)

    expect(
      alarm(
        "BEGIN:VALARM",
        "ACTION:EMAIL",
        "TRIGGER:-P1D",
        "END:VALARM",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "TRIGGER:-PT30M",
        "END:VALARM",
      ),
    ).toBe(30)

    expect(
      alarm(
        "BEGIN:VALARM",
        "TRIGGER;RELATED=END:-PT15M",
        "ACTION:DISPLAY",
        "END:VALARM",
      ),
    ).toBe(null)
  })

  test("unescapes text and unfolds wrapped lines", () => {
    const [parsed] = fromIcs(
      vevent(
        "SUMMARY:Tea\\, cake\\; c:\\\\eris",
        "DTSTART:20260902T090000",
        "DESCRIPTION:one\\ntw",
        " o",
      ),
    )

    expect(parsed.title).toBe("Tea, cake; c:\\eris")
    expect(parsed.notes).toBe("one\ntwo")
  })

  test("skips events it cannot map and ignores stray lines", () => {
    const text = [
      "BEGIN:VCALENDAR",
      "X-WR-CALNAME:Other",
      "BEGIN:VEVENT",
      "SUMMARY:No start",
      "END:VEVENT",
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Seoul",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "SUMMARY:Real",
      "DTSTART:20260902T090000",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n")

    const parsed = fromIcs(text)

    expect(parsed).toHaveLength(1)
    expect(parsed[0].title).toBe("Real")
    expect(parsed[0].end).toBe("2026-09-02T10:00")
  })

  test("returns nothing for a file without events", () => {
    expect(fromIcs("not a calendar")).toEqual([])
  })
})

describe("round trip", () => {
  test("export then import gives back the same events", () => {
    const list = [
      event(),
      event({
        id: "e2",
        title: "Trip, part 2",
        notes: "pack\nthings",
        allDay: true,
        start: "2026-09-02",
        end: "2026-09-05",
        color: "var(--color-accent)",
        reminderMinutes: 0,
        recurrence: "yearly",
      }),
      event({
        id: "e3",
        title: "Gym",
        recurrence: "weekdays",
        reminderMinutes: 30,
        start: "2026-09-02T18:00",
        end: "2026-09-02T19:15",
      }),
    ]

    expect(fromIcs(toIcs(list))).toEqual(list)
  })
})
