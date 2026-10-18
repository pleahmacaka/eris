import { expect, test } from "bun:test"
import { dateKey, parseLocal } from "@eris/data"
import {
  childrenOf,
  daySections,
  openOccurrence,
  orderedDay,
  rangeTone,
  selectedRange,
} from "../../../src/lib/panel/projections"
import { eventFixture, inTimezone } from "./test-fixtures"

const noHoliday = () => false

test("range sections deduplicate spans, not separate recurring occurrences", () => {
  inTimezone("America/New_York", () => {
    const spanning = eventFixture()
    const recurring = eventFixture({
      id: "daily",
      end: "2026-03-07",
      recurrence: "daily",
    })
    const sections = daySections(
      parseLocal("2026-03-07"),
      parseLocal("2026-03-09"),
      day => orderedDay([spanning, recurring], day, noHoliday),
    )

    expect(sections[2].day.getTime() - sections[1].day.getTime()).toBe(
      23 * 60 * 60 * 1000,
    )
    expect(sections.map(section => dateKey(section.day))).toEqual([
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
    ])
    expect(sections.map(section => section.events.map(e => e.id))).toEqual([
      ["event", "daily"],
      ["daily"],
      ["daily"],
    ])
    expect(sections.map(section => section.events.at(-1)?.start)).toEqual([
      "2026-03-07",
      "2026-03-08",
      "2026-03-09",
    ])
  })
})

test("all-day ordering uses explicit order then createdAt; timed order stays intact", () => {
  const timed = eventFixture({
    id: "timed",
    allDay: false,
    start: "2026-03-07T09:00",
    end: "2026-03-07T10:00",
  })
  const explicit = eventFixture({ id: "explicit", order: 0, createdAt: 100 })
  const older = eventFixture({ id: "older", createdAt: 1 })

  expect(
    orderedDay(
      [timed, older, explicit],
      parseLocal("2026-03-07"),
      noHoliday,
    ).map(e => e.id),
  ).toEqual(["explicit", "older", "timed"])
})

test("drag ranges normalize direction and join only within the current week", () => {
  const first = parseLocal("2026-03-07")
  const last = parseLocal("2026-03-09")
  const range = selectedRange(first, null, { from: last, to: first })

  expect(range).toEqual([first, last])
  expect(rangeTone(first, range, 0)).toEqual(["bg-primary/15", false, false])
  expect(rangeTone(parseLocal("2026-03-08"), range, 0)).toEqual([
    "bg-primary/15",
    false,
    "-mr-0.5 rounded-r-none",
  ])
  expect(rangeTone(parseLocal("2026-03-06"), range, 0)).toBeNull()
  expect(selectedRange(first, null, null)).toBeNull()
})

test("open recurring detail resolves the requested date, not the stored start", () => {
  const series = eventFixture({ recurrence: "daily", end: "2026-03-07" })
  const occurrence = openOccurrence(
    [series],
    { kind: "event", id: series.id, date: "2026-03-09" },
    noHoliday,
  )

  expect(occurrence?.start).toBe("2026-03-09")
  expect(occurrence?.seriesDate).toBe("2026-03-09")
  expect(openOccurrence([series], { kind: "day" }, noHoliday)).toBeNull()
  expect(
    childrenOf(
      [
        eventFixture({ id: "late", parentId: series.id, start: "2026-03-09" }),
        eventFixture({ id: "early", parentId: series.id, start: "2026-03-07" }),
        eventFixture({ id: "unrelated" }),
      ],
      series,
    ).map(e => e.id),
  ).toEqual(["early", "late"])
})
