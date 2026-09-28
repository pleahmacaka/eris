import { DOCK_ALIGNS, DOCK_STYLES, TERMINAL_APPS } from "@eris/settings"
import { parseLocal } from "./calendar"
import type { CalendarEvent, Note, Preset, Todo } from "./types"

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

const CHOICES: Partial<Record<string, unknown[]>> = {
  dockStyle: DOCK_STYLES,
  dockAlign: DOCK_ALIGNS,
  terminal: TERMINAL_APPS,
}

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

export const isPreset = (value: unknown): value is Preset =>
  isRecord(value) &&
  isStamped(value) &&
  isString(value.name) &&
  isRecord(value.appearance)

// a null default or an empty list in the settings defaults stands for strings
const fits = (fallback: unknown, candidate: unknown): boolean => {
  if (Array.isArray(fallback)) {
    return (
      Array.isArray(candidate) &&
      candidate.every(item => fits(fallback[0] ?? "", item))
    )
  }

  if (fallback === null) {
    return candidate === null || isString(candidate)
  }

  return (
    typeof candidate === typeof fallback &&
    isRecord(candidate) === isRecord(fallback)
  )
}

export const conform = <T extends Fields>(defaults: T, value: unknown): T => {
  if (!isRecord(value)) {
    return defaults
  }

  const merged: Fields = { ...defaults }

  for (const [key, fallback] of Object.entries(defaults)) {
    if (isRecord(fallback)) {
      merged[key] = conform(fallback, value[key])
    } else if (
      fits(fallback, value[key]) &&
      (CHOICES[key]?.includes(value[key]) ?? true)
    ) {
      merged[key] = value[key]
    }
  }

  return merged as T
}
