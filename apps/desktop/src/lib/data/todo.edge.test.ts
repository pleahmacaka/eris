import { describe, expect, test } from "bun:test"
import { dueLabel, isOverdue, parseQuickAdd, sortTodos } from "./todo"
import type { Todo } from "./types"

const now = new Date(2026, 8, 2, 10, 0)

const todo = (over: Partial<Todo> = {}): Todo => ({
  id: "t",
  title: "t",
  notes: "",
  done: false,
  doneAt: null,
  priority: 0,
  due: null,
  tags: [],
  order: 0,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

describe("parseQuickAdd tokens", () => {
  test("time before title", () => {
    expect(parseQuickAdd("tomorrow 3pm dentist", now)).toEqual({
      title: "dentist",
      due: "2026-09-03T15:00",
    })
  })

  test("priority, tag, weekday, 24h time", () => {
    expect(parseQuickAdd("!2 #work call mom fri 9:30", now)).toEqual({
      title: "call mom",
      priority: 2,
      tags: ["work"],
      due: "2026-09-04T09:30",
    })
  })

  test("date alone leaves an empty title", () => {
    expect(parseQuickAdd("2026-12-31", now)).toEqual({
      title: "",
      due: "2026-12-31",
    })
  })

  test("impossible date stays in the title", () => {
    expect(parseQuickAdd("Taxes 2026-02-31", now)).toEqual({
      title: "Taxes 2026-02-31",
    })
  })

  test("noon and midnight", () => {
    expect(parseQuickAdd("Lunch 12pm", now).due).toBe("2026-09-02T12:00")
    expect(parseQuickAdd("Sleep 12am", now).due).toBe("2026-09-02T00:00")
  })
})

describe("overdue boundaries", () => {
  test("all-day flips at midnight", () => {
    const item = todo({ due: "2026-09-02" })

    expect(isOverdue(item, new Date(2026, 8, 2, 23, 59, 59))).toBe(false)
    expect(isOverdue(item, new Date(2026, 8, 3, 0, 0, 0))).toBe(true)
  })

  test("timed flips at its minute", () => {
    const item = todo({ due: "2026-09-02T09:00" })

    expect(isOverdue(item, new Date(2026, 8, 2, 8, 59, 59))).toBe(false)
    expect(isOverdue(item, new Date(2026, 8, 2, 9, 0, 0))).toBe(true)
  })
})

describe("sorting by due", () => {
  test("all-day before timed on the same day, undated last", () => {
    const items = [
      todo({ id: "timed", due: "2026-09-05T09:00" }),
      todo({ id: "none" }),
      todo({ id: "day", due: "2026-09-05" }),
    ]

    expect(sortTodos(items, "due", true).map(t => t.id)).toEqual([
      "day",
      "timed",
      "none",
    ])
  })
})

describe("dueLabel window", () => {
  test("six days ahead is a weekday, seven is a date", () => {
    expect(dueLabel(todo({ due: "2026-09-08" }), now)).toBe("Tue")
    expect(dueLabel(todo({ due: "2026-09-09" }), now)).toBe("Sep 9")
  })
})
