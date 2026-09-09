import { describe, expect, test } from "bun:test"
import { formatDuration, parseTimer, remaining } from "./timers"

const NOW = new Date(2026, 8, 2, 8, 0, 0).getTime()
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 8, day, hour, minute, 0, 0).getTime()

describe("parseTimer durations", () => {
  test("unit suffixes and a label", () => {
    expect(parseTimer("5m tea", "timer", NOW)).toEqual({
      kind: "timer",
      label: "tea",
      fireAt: NOW + 300_000,
    })
    expect(parseTimer("90s", "timer", NOW)).toEqual({
      kind: "timer",
      label: "1m 30s",
      fireAt: NOW + 90_000,
    })
  })

  test("compound and spelled-out durations add up", () => {
    expect(parseTimer("1h30m", "timer", NOW)?.fireAt).toBe(NOW + 5_400_000)
    expect(parseTimer("2 hours 15 minutes", "timer", NOW)?.fireAt).toBe(
      NOW + 8_100_000,
    )
    expect(parseTimer("1 day", "timer", NOW)?.fireAt).toBe(NOW + 86_400_000)
  })

  test("a bare number means minutes", () => {
    expect(parseTimer("25 pomodoro", "timer", NOW)).toEqual({
      kind: "timer",
      label: "pomodoro",
      fireAt: NOW + 1_500_000,
    })
  })

  test("a label starting with a unit letter stays a label", () => {
    expect(parseTimer("30 standup", "timer", NOW)).toEqual({
      kind: "timer",
      label: "standup",
      fireAt: NOW + 1_800_000,
    })
    expect(parseTimer("10 dinner", "timer", NOW)?.fireAt).toBe(NOW + 600_000)
    expect(parseTimer("3 dog walk", "timer", NOW)?.label).toBe("dog walk")
    expect(parseTimer("5 Meeting", "timer", NOW)?.fireAt).toBe(NOW + 300_000)
  })

  test("rejects text without a duration", () => {
    expect(parseTimer("tea", "timer", NOW)).toBeNull()
    expect(parseTimer("", "timer", NOW)).toBeNull()
    expect(parseTimer("0m", "timer", NOW)).toBeNull()
  })
})

describe("parseTimer clock times", () => {
  test("a later time today fires today", () => {
    expect(parseTimer("18:00", "alarm", NOW)).toEqual({
      kind: "alarm",
      label: "6:00 PM",
      fireAt: at(2, 18, 0),
    })
  })

  test("a passed time rolls over to tomorrow", () => {
    expect(parseTimer("7:30 wake up", "alarm", NOW)).toEqual({
      kind: "alarm",
      label: "wake up",
      fireAt: at(3, 7, 30),
    })
  })

  test("am and pm", () => {
    expect(parseTimer("9am gym", "alarm", NOW)?.fireAt).toBe(at(2, 9, 0))
    expect(parseTimer("12am", "alarm", NOW)?.fireAt).toBe(at(3, 0, 0))
    expect(parseTimer("12pm", "alarm", NOW)?.fireAt).toBe(at(2, 12, 0))
    expect(parseTimer("1:05 pm", "alarm", NOW)?.fireAt).toBe(at(2, 13, 5))
  })

  test("timer mode still understands a clock time", () => {
    expect(parseTimer("9:30 standup", "timer", NOW)?.fireAt).toBe(at(2, 9, 30))
  })

  test("rejects impossible clock times", () => {
    expect(parseTimer("25:00", "alarm", NOW)).toBeNull()
    expect(parseTimer("7:99", "alarm", NOW)).toBeNull()
  })
})

describe("formatting", () => {
  test("durations read tersely", () => {
    expect(formatDuration(45_000)).toBe("45s")
    expect(formatDuration(300_000)).toBe("5m")
    expect(formatDuration(90_000)).toBe("1m 30s")
    expect(formatDuration(3_660_000)).toBe("1h 1m")
    expect(formatDuration(-5)).toBe("0s")
  })

  test("remaining counts down to the fire time", () => {
    const timer = { id: "1", kind: "timer" as const, label: "tea", fireAt: NOW }

    expect(remaining(timer, NOW - 65_000)).toBe("1m 5s")
    expect(remaining(timer, NOW + 5000)).toBe("0s")
  })
})
