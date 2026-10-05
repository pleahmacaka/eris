import { parseLocal } from "./calendar"
import type { CalendarEvent, Note, Todo } from "./types"

type Fields = Record<string, unknown>

const PRIORITIES: unknown[] = [0, 1, 2, 3]

const RECURRENCES: unknown[] = [
  "none",
  "daily",
  "weekdays",
  "weekly",
  "monthly",
  "yearly",
]

export const isRecord = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isString = (value: unknown) => typeof value === "string"

const isNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)

const isBoolean = (value: unknown) => typeof value === "boolean"

const isDate = (value: unknown) =>
  typeof value === "string" && !Number.isNaN(parseLocal(value).getTime())

const isStamped = (value: Fields) =>
  isString(value.id) && isNumber(value.createdAt) && isNumber(value.updatedAt)

export const isTodo = (value: unknown): value is Todo =>
  isRecord(value) &&
  isStamped(value) &&
  isString(value.title) &&
  isString(value.notes) &&
  isBoolean(value.done) &&
  (value.doneAt === null || isNumber(value.doneAt)) &&
  PRIORITIES.includes(value.priority) &&
  (value.due === null || isDate(value.due)) &&
  Array.isArray(value.tags) &&
  value.tags.every(isString) &&
  isNumber(value.order)

export const isCalendarEvent = (value: unknown): value is CalendarEvent =>
  isRecord(value) &&
  isStamped(value) &&
  isString(value.title) &&
  isString(value.notes) &&
  isDate(value.start) &&
  isDate(value.end) &&
  isBoolean(value.allDay) &&
  (value.color === null || isString(value.color)) &&
  (value.reminderMinutes === null || isNumber(value.reminderMinutes)) &&
  RECURRENCES.includes(value.recurrence)

export const isNote = (value: unknown): value is Note =>
  isRecord(value) &&
  isStamped(value) &&
  isString(value.title) &&
  isString(value.body) &&
  isBoolean(value.pinned) &&
  (value.color === null || isString(value.color))
