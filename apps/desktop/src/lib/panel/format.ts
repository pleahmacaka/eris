import { currentLocale } from "@eris/i18n"
import type { CalendarEvent } from "$lib/data"
import { parseLocal } from "$lib/data"

export const clock = (value: string) =>
  parseLocal(value).toLocaleTimeString(currentLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

export const eventTime = (event: CalendarEvent, allDayLabel: string) =>
  event.allDay ? allDayLabel : clock(event.start)

export const eventSpan = (event: CalendarEvent, allDayLabel: string) => {
  if (event.allDay) {
    return allDayLabel
  }

  return `${clock(event.start)} – ${clock(event.end)}`
}

export const longDay = (day: Date) =>
  day.toLocaleDateString(currentLocale(), {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })
