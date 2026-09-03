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

describe("parseQuickAdd", () => {
  test("plain title", () => {
    expect(parseQuickAdd("Buy milk", now)).toEqual({ title: "Buy milk" })
  })

  test("priority and tags", () => {
    expect(parseQuickAdd("Ship it !2 #work #eris", now)).toEqual({
      title: "Ship it",
      priority: 2,
      tags: ["work", "eris"],
    })
  })

  test("today and tomorrow", () => {
    expect(parseQuickAdd("Call mom today", now).due).toBe("2026-09-02")
    expect(parseQuickAdd("Call mom tomorrow", now).due).toBe("2026-09-03")
  })

  test("weekday names pick the next occurrence", () => {
    expect(parseQuickAdd("Standup mon", now).due).toBe("2026-09-07")
    expect(parseQuickAdd("Gym wed", now).due).toBe("2026-09-09")
    expect(parseQuickAdd("Gym friday", now).due).toBe("2026-09-04")
  })

  test("explicit date", () => {
    expect(parseQuickAdd("Taxes 2026-12-24", now).due).toBe("2026-12-24")
  })

  test("time alone means today", () => {
    expect(parseQuickAdd("Dentist 3pm", now).due).toBe("2026-09-02T15:00")
    expect(parseQuickAdd("Dentist 15:30", now).due).toBe("2026-09-02T15:30")
  })

  test("date plus time", () => {
    expect(parseQuickAdd("Dentist tomorrow 9:30am", now).due).toBe(
      "2026-09-03T09:30",
    )
  })

  test("bare numbers and lone hashes stay in the title", () => {
    expect(parseQuickAdd("Buy 10 apples #", now).title).toBe("Buy 10 apples #")
  })
})

describe("sortTodos", () => {
  const items = [
    todo({ id: "a", order: 2, priority: 1, due: "2026-09-05" }),
    todo({ id: "b", order: 0, priority: 3, due: null }),
    todo({ id: "c", order: 1, priority: 2, due: "2026-09-03", done: true }),
    todo({ id: "d", order: 3, priority: 2, due: "2026-09-01" }),
  ]
  const ids = (list: Todo[]) => list.map(t => t.id)

  test("manual hides completed and follows order", () => {
    expect(ids(sortTodos(items, "manual", false))).toEqual(["b", "a", "d"])
  })

  test("completed go last when shown", () => {
    expect(ids(sortTodos(items, "manual", true))).toEqual(["b", "a", "d", "c"])
  })

  test("due puts undated last", () => {
    expect(ids(sortTodos(items, "due", false))).toEqual(["d", "a", "b"])
  })

  test("priority high first", () => {
    expect(ids(sortTodos(items, "priority", false))).toEqual(["b", "d", "a"])
  })
})

describe("isOverdue", () => {
  test("date-only is overdue after the day ends", () => {
    expect(isOverdue(todo({ due: "2026-09-02" }), now)).toBe(false)
    expect(isOverdue(todo({ due: "2026-09-01" }), now)).toBe(true)
  })

  test("timed and done", () => {
    expect(isOverdue(todo({ due: "2026-09-02T09:00" }), now)).toBe(true)
    expect(isOverdue(todo({ due: "2026-09-02T11:00" }), now)).toBe(false)
    expect(isOverdue(todo({ due: "2026-09-01", done: true }), now)).toBe(false)
  })
})

describe("dueLabel", () => {
  test("relative days", () => {
    expect(dueLabel(todo({ due: "2026-09-02" }), now)).toBe("Today")
    expect(dueLabel(todo({ due: "2026-09-03" }), now)).toBe("Tomorrow")
    expect(dueLabel(todo({ due: "2026-09-01" }), now)).toBe("Yesterday")
    expect(dueLabel(todo({ due: "2026-09-04" }), now)).toBe("Fri")
    expect(dueLabel(todo({ due: "2026-09-20" }), now)).toBe("Sep 20")
    expect(dueLabel(todo({ due: "2027-01-05" }), now)).toBe("Jan 5, 2027")
    expect(dueLabel(todo(), now)).toBe("")
  })

  test("now shifts the label and overdue", () => {
    const item = todo({ due: "2026-09-03" })

    expect(dueLabel(item, now)).toBe("Tomorrow")
    expect(dueLabel(item, new Date(2026, 8, 3, 10, 0))).toBe("Today")
    expect(isOverdue(item, now)).toBe(false)
    expect(isOverdue(item, new Date(2026, 8, 4, 0, 0))).toBe(true)
  })

  test("timed appends the time", () => {
    expect(dueLabel(todo({ due: "2026-09-02T15:00" }), now)).toMatch(
      /^Today 3:00\sPM$/,
    )
  })
})
