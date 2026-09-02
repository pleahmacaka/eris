import type { TodoSort } from "../settings"
import {
  addDays,
  atMinutes,
  dateKey,
  dateTimeKey,
  parseDay,
  parseLocal,
  parseTime,
  resolveRange,
  startOfDay,
  type Time,
} from "./calendar"
import type { Priority, Todo } from "./types"

const PRIORITY_TOKENS: Record<string, Priority> = { "!1": 1, "!2": 2, "!3": 3 }
const NO_DUE = Number.MAX_SAFE_INTEGER

export const parseQuickAdd = (
  text: string,
  now = new Date(),
): Partial<Todo> => {
  const words: string[] = []
  const tags: string[] = []
  let priority: Priority | undefined
  let day: Date | null = null
  let time: Time | null = null

  for (const token of text.trim().split(" ").filter(Boolean)) {
    if (token.length > 1 && token.startsWith("#")) {
      tags.push(token.slice(1))
      continue
    }

    if (token in PRIORITY_TOKENS) {
      priority = PRIORITY_TOKENS[token]
      continue
    }

    const parsedDay = parseDay(token, now)

    if (parsedDay) {
      day = parsedDay
      continue
    }

    const parsedTime = parseTime(token)

    if (parsedTime) {
      time = parsedTime
      continue
    }

    words.push(token)
  }

  const result: Partial<Todo> = { title: words.join(" ") }

  if (tags.length) {
    result.tags = tags
  }

  if (priority !== undefined) {
    result.priority = priority
  }

  if (time) {
    const base = day ?? startOfDay(now)
    result.due = dateTimeKey(atMinutes(base, resolveRange(time, null).start))
  } else if (day) {
    result.due = dateKey(day)
  }

  return result
}

const dueAt = (todo: Todo) =>
  todo.due ? parseLocal(todo.due).getTime() : NO_DUE

const compare: Record<TodoSort, (a: Todo, b: Todo) => number> = {
  manual: () => 0,
  due: (a, b) => dueAt(a) - dueAt(b),
  priority: (a, b) => b.priority - a.priority,
}

export const sortTodos = (
  items: Todo[],
  sortBy: TodoSort,
  showCompleted: boolean,
) => {
  const visible = showCompleted ? items : items.filter(t => !t.done)

  return [...visible].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      compare[sortBy](a, b) ||
      a.order - b.order ||
      a.createdAt - b.createdAt,
  )
}

const dueDeadline = (due: string) => {
  const parsed = parseLocal(due)

  return due.length === 10 ? addDays(parsed, 1).getTime() : parsed.getTime()
}

export const isOverdue = (todo: Todo, now = new Date()) =>
  !todo.done && todo.due !== null && dueDeadline(todo.due) <= now.getTime()

const dayLabel = (day: Date, today: Date) => {
  const distance = Math.round((day.getTime() - today.getTime()) / 86_400_000)

  if (distance === 0) {
    return "Today"
  }

  if (distance === 1) {
    return "Tomorrow"
  }

  if (distance === -1) {
    return "Yesterday"
  }

  if (distance > 1 && distance < 7) {
    return day.toLocaleDateString("en-US", { weekday: "short" })
  }

  return day.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: day.getFullYear() === today.getFullYear() ? undefined : "numeric",
  })
}

export const dueLabel = (todo: Todo, now = new Date()) => {
  if (!todo.due) {
    return ""
  }

  const due = parseLocal(todo.due)
  const label = dayLabel(startOfDay(due), startOfDay(now))

  if (todo.due.length === 10) {
    return label
  }

  const time = due.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

  return `${label} ${time}`
}
