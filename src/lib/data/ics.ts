import { addDays, dateKey, dateTimeKey, parseLocal } from "./calendar"
import type { CalendarEvent, Recurrence } from "./types"

const CRLF = "\r\n"
const FOLD_OCTETS = 75
const WEEKDAYS = "MO,TU,WE,TH,FR"

const encoder = new TextEncoder()

const RULES: Record<Exclude<Recurrence, "none">, string> = {
  daily: "FREQ=DAILY",
  weekdays: `FREQ=WEEKLY;BYDAY=${WEEKDAYS}`,
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
  yearly: "FREQ=YEARLY",
}

const UNITS: Record<string, number> = {
  W: 10_080,
  D: 1_440,
  H: 60,
  M: 1,
  S: 1 / 60,
}

const pad = (n: number) => String(n).padStart(2, "0")

const escapeText = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\n")

const unescapeText = (value: string) => {
  let out = ""

  for (let i = 0; i < value.length; i++) {
    if (value[i] !== "\\") {
      out += value[i]
      continue
    }

    const next = value[++i] ?? ""

    out += next === "n" || next === "N" ? "\n" : next
  }

  return out
}

const fold = (line: string) => {
  const out: string[] = []
  let current = ""
  let octets = 0

  for (const char of line) {
    const size = encoder.encode(char).length

    if (octets + size > FOLD_OCTETS) {
      out.push(current)
      current = " "
      octets = 1
    }

    current += char
    octets += size
  }

  out.push(current)

  return out
}

const dateStamp = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

const localStamp = (d: Date) =>
  `${dateStamp(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`

const utcStamp = (ms: number) => {
  const d = new Date(ms)
  const day = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
  const time = `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`

  return `${day}T${time}Z`
}

const trigger = (minutes: number) => {
  if (minutes === 0) {
    return "PT0S"
  }

  return minutes > 0 ? `-PT${minutes}M` : `PT${-minutes}M`
}

const eventLines = (event: CalendarEvent) => {
  const start = parseLocal(event.start)
  const end = parseLocal(event.end)
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.id}@eris`,
    `DTSTAMP:${utcStamp(event.updatedAt)}`,
    `CREATED:${utcStamp(event.createdAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ]

  if (event.allDay) {
    lines.push(
      `DTSTART;VALUE=DATE:${dateStamp(start)}`,
      `DTEND;VALUE=DATE:${dateStamp(addDays(end, 1))}`,
    )
  } else {
    lines.push(`DTSTART:${localStamp(start)}`, `DTEND:${localStamp(end)}`)
  }

  if (event.notes) {
    lines.push(`DESCRIPTION:${escapeText(event.notes)}`)
  }

  if (event.recurrence !== "none") {
    lines.push(`RRULE:${RULES[event.recurrence]}`)
  }

  if (event.color) {
    lines.push(`X-ERIS-COLOR:${escapeText(event.color)}`)
  }

  if (event.reminderMinutes !== null) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(event.title)}`,
      `TRIGGER:${trigger(event.reminderMinutes)}`,
      "END:VALARM",
    )
  }

  lines.push("END:VEVENT")

  return lines
}

export const toIcs = (list: CalendarEvent[]) => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eris//Panel//EN",
    "CALSCALE:GREGORIAN",
    ...list.flatMap(eventLines),
    "END:VCALENDAR",
  ]

  return `${lines.flatMap(fold).join(CRLF)}${CRLF}`
}

type Line = { name: string; params: string; value: string }

const parseLine = (raw: string): Line[] => {
  const colon = raw.indexOf(":")

  if (colon < 0) {
    return []
  }

  const [name, ...params] = raw.slice(0, colon).split(";")

  return [
    {
      name: name.trim().toUpperCase(),
      params: params.join(";"),
      value: raw.slice(colon + 1),
    },
  ]
}

const unquote = (value: string) =>
  value.startsWith('"') && value.endsWith('"') ? value.slice(1, -1) : value

const zoneOf = (params: string) => {
  for (const part of params.split(";")) {
    const trimmed = part.trim()

    if (trimmed.toUpperCase().startsWith("TZID=")) {
      return unquote(trimmed.slice(5)) || null
    }
  }

  return null
}

const zoneShift = (ms: number, zone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ms))
  const at = (type: string) =>
    Number(parts.find(part => part.type === type)?.value)

  return (
    Date.UTC(
      at("year"),
      at("month") - 1,
      at("day"),
      at("hour"),
      at("minute"),
      at("second"),
    ) - ms
  )
}

// Outlook writes Windows zone names ("Eastern Standard Time"); Intl throws on those
const fromZone = (wall: Date, zone: string) => {
  try {
    const utc = Date.UTC(
      wall.getFullYear(),
      wall.getMonth(),
      wall.getDate(),
      wall.getHours(),
      wall.getMinutes(),
      wall.getSeconds(),
    )
    const guess = utc - zoneShift(utc, zone)

    return new Date(utc - zoneShift(guess, zone))
  } catch {
    return wall
  }
}

const contentLines = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .flatMap(parseLine)

const digits = (value: string, from: number, to: number) => {
  const part = value.slice(from, to)
  const full = part.length === to - from

  return full && [...part].every(c => c >= "0" && c <= "9")
    ? Number(part)
    : Number.NaN
}

type Stamp = { date: Date; isDate: boolean }

const parseStamp = (value: string, params = ""): Stamp | null => {
  const raw = value.trim()
  const year = digits(raw, 0, 4)
  const month = digits(raw, 4, 6)
  const day = digits(raw, 6, 8)

  if (Number.isNaN(year + month + day)) {
    return null
  }

  if (raw.length === 8) {
    return { date: new Date(year, month - 1, day), isDate: true }
  }

  if (raw[8] !== "T") {
    return null
  }

  const hours = digits(raw, 9, 11)
  const minutes = digits(raw, 11, 13)
  const seconds = digits(raw, 13, 15)

  if (Number.isNaN(hours + minutes)) {
    return null
  }

  const rest = Number.isNaN(seconds) ? 0 : seconds

  if (raw.endsWith("Z")) {
    const utc = Date.UTC(year, month - 1, day, hours, minutes, rest)

    return { date: new Date(utc), isDate: false }
  }

  const local = new Date(year, month - 1, day, hours, minutes, rest)
  const zone = zoneOf(params)

  return { date: zone ? fromZone(local, zone) : local, isDate: false }
}

const sorted = (list: string) =>
  list
    .split(",")
    .map(day => day.trim())
    .sort()
    .join(",")

const parseRule = (value: string): Recurrence => {
  const parts = new Map<string, string>()

  for (const part of value.split(";")) {
    const at = part.indexOf("=")

    if (at > 0) {
      const key = part.slice(0, at).trim().toUpperCase()

      parts.set(key, part.slice(at + 1).toUpperCase())
    }
  }

  const byDay = parts.get("BYDAY")

  switch (parts.get("FREQ")) {
    case "DAILY":
      return "daily"
    case "WEEKLY":
      return byDay && sorted(byDay) === sorted(WEEKDAYS) ? "weekdays" : "weekly"
    case "MONTHLY":
      return "monthly"
    case "YEARLY":
      return "yearly"
    default:
      return "none"
  }
}

const durationMinutes = (value: string) => {
  let total = 0
  let number = ""

  for (const char of value) {
    if (char >= "0" && char <= "9") {
      number += char
      continue
    }

    const unit = UNITS[char]

    if (unit !== undefined && number) {
      total += Number(number) * unit
    }

    number = ""
  }

  return total
}

const parseDuration = (value: string) => {
  const raw = value.trim().toUpperCase()
  const body = raw.startsWith("-") ? raw.slice(1) : raw

  return body.startsWith("P") ? Math.round(durationMinutes(body)) : null
}

const triggerMinutes = (value: string) => {
  const minutes = parseDuration(value)

  if (minutes === null) {
    return null
  }

  return value.trim().startsWith("-") || minutes === 0 ? minutes : -minutes
}

type Alarm = { action: string; minutes: number | null }

const ALARM_ACTIONS = ["DISPLAY", "AUDIO", ""]

type Draft = {
  uid: string
  title: string
  notes: string
  start: Stamp | null
  end: Stamp | null
  duration: number | null
  color: string | null
  reminderMinutes: number | null
  recurrence: Recurrence
  createdAt: number | null
  updatedAt: number | null
}

const blank = (): Draft => ({
  uid: "",
  title: "",
  notes: "",
  start: null,
  end: null,
  duration: null,
  color: null,
  reminderMinutes: null,
  recurrence: "none",
  createdAt: null,
  updatedAt: null,
})

const applyAlarm = (alarm: Alarm, line: Line) => {
  if (line.name === "ACTION") {
    alarm.action = line.value.trim().toUpperCase()
  }

  if (line.name === "TRIGGER") {
    alarm.minutes = line.params.toUpperCase().includes("RELATED=END")
      ? null
      : triggerMinutes(line.value)
  }
}

const apply = (draft: Draft, line: Line) => {
  switch (line.name) {
    case "UID":
      draft.uid = line.value.trim()
      break
    case "SUMMARY":
      draft.title = unescapeText(line.value)
      break
    case "DESCRIPTION":
      draft.notes = unescapeText(line.value)
      break
    case "DTSTART":
      draft.start = parseStamp(line.value, line.params) ?? draft.start
      break
    case "DTEND":
      draft.end = parseStamp(line.value, line.params) ?? draft.end
      break
    case "DURATION":
      draft.duration = parseDuration(line.value)
      break
    case "RRULE":
      draft.recurrence = parseRule(line.value)
      break
    case "X-ERIS-COLOR":
      draft.color = unescapeText(line.value) || null
      break
    case "DTSTAMP":
      draft.updatedAt = parseStamp(line.value)?.date.getTime() ?? null
      break
    case "CREATED":
      draft.createdAt = parseStamp(line.value)?.date.getTime() ?? null
      break
    default:
      break
  }
}

const eventId = (uid: string) => {
  if (uid.endsWith("@eris")) {
    return uid.slice(0, -5)
  }

  return uid || crypto.randomUUID()
}

const finish = (draft: Draft): CalendarEvent | null => {
  if (!draft.start || Number.isNaN(draft.start.date.getTime())) {
    return null
  }

  const allDay = draft.start.isDate
  const from = draft.start.date
  const closes = draft.end?.date ?? null
  const last =
    allDay && closes && draft.end?.isDate ? addDays(closes, -1) : closes
  const minutes = draft.duration
  const fallback = allDay
    ? addDays(from, Math.max(1, Math.round((minutes ?? 0) / 1440)) - 1)
    : new Date(from.getTime() + (minutes ?? 60) * 60_000)
  const to = (allDay ? last : closes) ?? fallback
  const end = to < from ? from : to
  const stamp = draft.updatedAt ?? Date.now()

  return {
    id: eventId(draft.uid),
    title: draft.title.trim() || "Untitled",
    notes: draft.notes,
    start: allDay ? dateKey(from) : dateTimeKey(from),
    end: allDay ? dateKey(end) : dateTimeKey(end),
    allDay,
    color: draft.color,
    reminderMinutes: draft.reminderMinutes,
    recurrence: draft.recurrence,
    createdAt: draft.createdAt ?? stamp,
    updatedAt: stamp,
  }
}

export const fromIcs = (text: string): CalendarEvent[] => {
  const found: CalendarEvent[] = []
  let draft: Draft | null = null
  let alarm: Alarm | null = null

  for (const line of contentLines(text)) {
    const block = line.value.trim().toUpperCase()

    if (line.name === "BEGIN" && block === "VEVENT") {
      draft = blank()
      alarm = null
      continue
    }

    if (!draft) {
      continue
    }

    if (line.name === "BEGIN") {
      alarm ??= block === "VALARM" ? { action: "", minutes: null } : null
      continue
    }

    if (line.name === "END" && block === "VALARM") {
      if (
        alarm &&
        draft.reminderMinutes === null &&
        ALARM_ACTIONS.includes(alarm.action)
      ) {
        draft.reminderMinutes = alarm.minutes
      }

      alarm = null
      continue
    }

    if (line.name === "END" && block === "VEVENT") {
      const event = finish(draft)

      if (event) {
        found.push(event)
      }

      draft = null
      continue
    }

    if (alarm) {
      applyAlarm(alarm, line)
      continue
    }

    apply(draft, line)
  }

  return found
}
