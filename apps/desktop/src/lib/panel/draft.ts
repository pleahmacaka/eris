import {
  addDays,
  atMinutes,
  type CalendarEvent,
  dateKey,
  dateTimeKey,
  dayDelta,
  newId,
  openEnded,
  parseLocal,
  parseTime,
  parseTimeToken,
  type Recurrence,
  type Shift,
  shiftable,
  timeMinutes,
  withoutToken,
} from "$lib/data"
import { type EventColor, toColor } from "./colors"

export type Seed = { day: Date; span: number; parent: string | null }

export type Draft = {
  title: string
  notes: string
  allDay: boolean
  date: string
  start: string
  end: string
  hasEnd: boolean
  days: number
  color: EventColor
  recurrence: Recurrence
  shift: Shift | "none"
  reminder: number | null
  tags: string[]
  parent: string | null
}

const DAY = 86_400_000
const DAY_MINUTES = 1_440
const DEFAULT_LENGTH = 60
const DEFAULT_START = "10:00"
const DEFAULT_END = "11:00"
const CLOCK_DAY = new Date(2000, 0, 1)

export const clockAt = (minutes: number) =>
  dateTimeKey(atMinutes(CLOCK_DAY, minutes)).slice(11)

const clockOf = (value: string) => dateTimeKey(parseLocal(value)).slice(11)

const minutesOf = (value: string) => {
  const time = parseTime(value)

  return time ? timeMinutes(time) : Number.NaN
}

const keptDays = (event: CalendarEvent) => {
  const length =
    parseLocal(event.end).getTime() - parseLocal(event.start).getTime()

  return !event.allDay && length < DAY
    ? 0
    : Math.max(0, dayDelta(event.start, event.end))
}

export const draftFrom = (
  event: CalendarEvent | null,
  seed: Seed,
  reminder: number | null,
): Draft => {
  const timed = event !== null && !event.allDay

  return {
    title: event?.title ?? "",
    notes: event?.notes ?? "",
    allDay: event?.allDay ?? seed.span > 0,
    date: dateKey(event ? parseLocal(event.start) : seed.day),
    start: timed ? clockOf(event.start) : DEFAULT_START,
    end: timed ? clockOf(event.end) : DEFAULT_END,
    hasEnd: !event || !openEnded(event),
    days: event ? keptDays(event) : seed.span,
    color: toColor(event?.color ?? null),
    recurrence: event?.recurrence ?? "none",
    shift: event?.shift ?? "none",
    reminder: event ? event.reminderMinutes : reminder,
    tags: event?.tags ?? [],
    parent: event ? (event.parentId ?? null) : seed.parent,
  }
}

export const finalTitle = (draft: Draft) => {
  const token = parseTimeToken(draft.title)

  return (
    token && !draft.allDay ? withoutToken(draft.title, token) : draft.title
  ).trim()
}

export const withTime = (draft: Draft, at: number): Draft => {
  const length =
    (minutesOf(draft.end) - minutesOf(draft.start) + DAY_MINUTES) %
      DAY_MINUTES || DEFAULT_LENGTH

  return {
    ...draft,
    start: clockAt(at),
    end: clockAt(at + length),
    allDay: false,
  }
}

const timesOf = (draft: Draft) => {
  const day = parseLocal(draft.date)
  const start = atMinutes(day, minutesOf(draft.start))

  if (!draft.hasEnd) {
    return { day, start, end: start }
  }

  const end = atMinutes(addDays(day, draft.days), minutesOf(draft.end))

  return { day, start, end: end < start ? addDays(end, 1) : end }
}

export const isValid = (draft: Draft) => {
  const { day, start, end } = timesOf(draft)

  if (finalTitle(draft) === "" || Number.isNaN(day.getTime())) {
    return false
  }

  return (
    draft.allDay ||
    (!Number.isNaN(start.getTime()) && (!draft.hasEnd || end > start))
  )
}

export const eventFrom = (
  draft: Draft,
  stored: CalendarEvent | undefined,
  stamp: number,
): CalendarEvent => {
  const { day, start, end } = timesOf(draft)

  return {
    ...stored,
    id: stored?.id ?? newId(),
    title: finalTitle(draft),
    notes: draft.notes,
    allDay: draft.allDay,
    start: draft.allDay ? dateKey(day) : dateTimeKey(start),
    end: draft.allDay ? dateKey(addDays(day, draft.days)) : dateTimeKey(end),
    color: draft.color === "primary" ? null : `var(--color-${draft.color})`,
    reminderMinutes: draft.reminder,
    recurrence: draft.recurrence,
    tags: draft.tags,
    parentId: draft.parent,
    shift:
      shiftable(draft.recurrence) && draft.shift !== "none"
        ? draft.shift
        : undefined,
    createdAt: stored?.createdAt ?? stamp,
    updatedAt: stamp,
  }
}
