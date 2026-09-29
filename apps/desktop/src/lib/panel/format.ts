import { currentLocale } from "@eris/i18n"
import type { CalendarEvent } from "$lib/data"
import { dateKey, parseLocal } from "$lib/data"

export const clock = (value: string) =>
  parseLocal(value).toLocaleTimeString(currentLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })

export const eventTime = (event: CalendarEvent, allDayLabel: string) =>
  event.allDay ? allDayLabel : clock(event.start)

export const shortDay = (day: Date) =>
  day.toLocaleDateString(currentLocale(), {
    month: "short",
    day: "numeric",
    weekday: "short",
  })

export const eventSpan = (event: CalendarEvent, allDayLabel: string) => {
  const start = parseLocal(event.start)
  const end = parseLocal(event.end)
  const sameDay = dateKey(start) === dateKey(end)

  if (event.allDay) {
    return sameDay ? allDayLabel : `${shortDay(start)} – ${shortDay(end)}`
  }

  if (sameDay) {
    return `${clock(event.start)} – ${clock(event.end)}`
  }

  return `${shortDay(start)} ${clock(event.start)} – ${shortDay(end)} ${clock(event.end)}`
}

export const longDay = (day: Date) =>
  day.toLocaleDateString(currentLocale(), {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })
