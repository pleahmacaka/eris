import type { CalendarEvent, Recurrence } from "./types"

const DAY = 86_400_000
const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
const FULL_DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
]

export type Meridiem = "am" | "pm" | null

export type Time = { hours: number; minutes: number; meridiem: Meridiem }

const pad = (n: number) => String(n).padStart(2, "0")

export const dateKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const dateTimeKey = (d: Date) =>
  `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`

// date-only ISO strings parse as UTC midnight; all-day dates must stay local
export const parseLocal = (value: string) => {
  if (value.length === 10) {
    const [year, month, day] = value.split("-").map(Number)

    return new Date(year, month - 1, day)
  }

  return new Date(value)
}

export const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const addDays = (d: Date, n: number) => {
  const next = new Date(d)
  next.setDate(next.getDate() + n)

  return next
}

const shiftMonths = (origin: Date, months: number) => {
  const next = new Date(
    origin.getFullYear(),
    origin.getMonth() + months,
    1,
    origin.getHours(),
    origin.getMinutes(),
  )
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(origin.getDate(), lastDay))

  return next
}

const shiftStart = (recurrence: Recurrence, origin: Date, n: number) => {
  switch (recurrence) {
    case "weekly":
      return addDays(origin, 7 * n)
    case "monthly":
      return shiftMonths(origin, n)
    case "yearly":
      return shiftMonths(origin, 12 * n)
    default:
      return addDays(origin, n)
  }
}

const monthsBetween = (origin: Date, target: Date) =>
  (target.getFullYear() - origin.getFullYear()) * 12 +
  target.getMonth() -
  origin.getMonth()

const firstStep = (
  recurrence: Recurrence,
  origin: Date,
  duration: number,
  from: Date,
) => {
  const target = new Date(from.getTime() - duration)
  const gap = target.getTime() - origin.getTime()

  if (gap <= 0) {
    return 0
  }

  const steps =
    recurrence === "weekly"
      ? gap / (7 * DAY)
      : recurrence === "daily" || recurrence === "weekdays"
        ? gap / DAY
        : recurrence === "monthly"
          ? monthsBetween(origin, target)
          : recurrence === "yearly"
            ? monthsBetween(origin, target) / 12
            : 0

  return Math.max(0, Math.floor(steps) - 1)
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6

const span = (event: CalendarEvent) => {
  const start = parseLocal(event.start)
  const rawEnd = parseLocal(event.end)
  const end = event.allDay
    ? addDays(startOfDay(rawEnd < start ? start : rawEnd), 1)
    : rawEnd < start
      ? start
      : rawEnd

  return { start, end }
}

const occurrenceOf = (
  event: CalendarEvent,
  start: Date,
  end: Date,
): CalendarEvent => ({
  ...event,
  start: event.allDay ? dateKey(start) : dateTimeKey(start),
  end: event.allDay ? dateKey(addDays(end, -1)) : dateTimeKey(end),
})

export const occurrences = (
  event: CalendarEvent,
  from: Date,
  to: Date,
): CalendarEvent[] => {
  const origin = span(event)
  const duration = origin.end.getTime() - origin.start.getTime()

  if (Number.isNaN(duration)) {
    return []
  }

  if (event.recurrence === "none") {
    return origin.start < to && origin.end > from ? [event] : []
  }

  const found: CalendarEvent[] = []
  const days = Math.round(duration / DAY)

  for (
    let n = firstStep(event.recurrence, origin.start, duration, from);
    ;
    n++
  ) {
    const start = shiftStart(event.recurrence, origin.start, n)

    if (start >= to) {
      break
    }

    const end = event.allDay
      ? addDays(start, days)
      : new Date(start.getTime() + duration)

    if (end <= from) {
      continue
    }

    if (event.recurrence === "weekdays" && isWeekend(start)) {
      continue
    }

    found.push(occurrenceOf(event, start, end))
  }

  return found
}

const byStart = (a: CalendarEvent, b: CalendarEvent) =>
  Number(b.allDay) - Number(a.allDay) ||
  parseLocal(a.start).getTime() - parseLocal(b.start).getTime()

export const monthGrid = (
  year: number,
  month: number,
  weekStartsOn: 0 | 1,
): Date[][] => {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() - weekStartsOn + 7) % 7
  const start = addDays(first, -offset)

  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  )
}

export const eventsOn = (events: CalendarEvent[], date: Date) => {
  const from = startOfDay(date)
  const to = addDays(from, 1)

  return events.flatMap(e => occurrences(e, from, to)).sort(byStart)
}

export const upcoming = (events: CalendarEvent[], from: Date, days: number) => {
  const to = addDays(from, days)

  return events.flatMap(e => occurrences(e, from, to)).sort(byStart)
}

const formatTime = (d: Date) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

const formatDay = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" })

export const formatRange = (event: CalendarEvent) => {
  const start = parseLocal(event.start)
  const end = parseLocal(event.end)
  const sameDay = dateKey(start) === dateKey(end)

  if (event.allDay) {
    return sameDay ? "All day" : `${formatDay(start)} – ${formatDay(end)}`
  }

  if (sameDay) {
    return `${formatTime(start)} – ${formatTime(end)}`
  }

  return `${formatDay(start)} ${formatTime(start)} – ${formatDay(end)} ${formatTime(end)}`
}

export const parseDay = (token: string, now: Date): Date | null => {
  const word = token.toLowerCase()
  const today = startOfDay(now)

  if (word === "today") {
    return today
  }

  if (word === "tomorrow") {
    return addDays(today, 1)
  }

  const weekday = Math.max(
    DAY_NAMES.indexOf(word),
    FULL_DAY_NAMES.indexOf(word),
  )

  if (weekday >= 0) {
    return addDays(today, ((weekday - today.getDay() + 6) % 7) + 1)
  }

  if (word.length === 10 && word.split("-").length === 3) {
    const parsed = parseLocal(word)

    return dateKey(parsed) === word ? parsed : null
  }

  return null
}

export const parseTime = (token: string, allowBare = false): Time | null => {
  const word = token.toLowerCase()
  const meridiem: Meridiem = word.endsWith("am")
    ? "am"
    : word.endsWith("pm")
      ? "pm"
      : null
  const digits = meridiem ? word.slice(0, -2) : word

  if (!meridiem && !digits.includes(":") && !allowBare) {
    return null
  }

  const [hoursText, minutesText = "0", extra] = digits.split(":")

  if (extra !== undefined || !/^\d{1,2}$/.test(hoursText)) {
    return null
  }

  if (minutesText !== "0" && !/^\d{2}$/.test(minutesText)) {
    return null
  }

  const hours = Number(hoursText)
  const minutes = Number(minutesText)

  if (hours > 23 || minutes > 59 || (meridiem && hours > 12)) {
    return null
  }

  return { hours, minutes, meridiem }
}

const toMinutes = (time: Time) => {
  const hours =
    time.meridiem === "pm" && time.hours < 12
      ? time.hours + 12
      : time.meridiem === "am" && time.hours === 12
        ? 0
        : time.hours

  return hours * 60 + time.minutes
}

export const parseTimeRange = (token: string) => {
  const [first, second, extra] = token.toLowerCase().split("-")

  if (extra !== undefined || !first) {
    return null
  }

  const start = parseTime(first, second !== undefined)

  if (!start) {
    return null
  }

  if (second === undefined) {
    return { start, end: null }
  }

  const end = parseTime(second, true)

  return end ? { start, end } : null
}

export const resolveRange = (start: Time, end: Time | null) => {
  let startMinutes = toMinutes(start)

  if (!end) {
    return { start: startMinutes, end: startMinutes + 60 }
  }

  let endMinutes = toMinutes(end)

  if (
    !start.meridiem &&
    end.meridiem === "pm" &&
    startMinutes < 12 * 60 &&
    startMinutes + 12 * 60 <= endMinutes
  ) {
    startMinutes += 12 * 60
  }

  if (!end.meridiem && endMinutes < startMinutes) {
    endMinutes += 12 * 60
  }

  if (endMinutes < startMinutes) {
    endMinutes = toMinutes(end) + 24 * 60
  } else if (endMinutes === startMinutes) {
    endMinutes = startMinutes + 60
  }

  return { start: startMinutes, end: endMinutes }
}

export const atMinutes = (day: Date, minutes: number) =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
  )

export const parseQuickEvent = (
  text: string,
  now = new Date(),
): Partial<CalendarEvent> => {
  const words: string[] = []
  let day: Date | null = null
  let range: { start: Time; end: Time | null } | null = null

  for (const token of text.trim().split(" ").filter(Boolean)) {
    const parsedDay = parseDay(token, now)

    if (parsedDay) {
      day = parsedDay
      continue
    }

    const parsedRange = parseTimeRange(token)

    if (parsedRange) {
      range = parsedRange
      continue
    }

    words.push(token)
  }

  const title = words.join(" ")
  const base = day ?? startOfDay(now)

  if (!range) {
    return { title, allDay: true, start: dateKey(base), end: dateKey(base) }
  }

  const minutes = resolveRange(range.start, range.end)

  return {
    title,
    allDay: false,
    start: dateTimeKey(atMinutes(base, minutes.start)),
    end: dateTimeKey(atMinutes(base, minutes.end)),
  }
}
