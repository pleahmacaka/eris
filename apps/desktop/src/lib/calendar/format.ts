import { type CalendarEvent, dateKey, openEnded, parseLocal } from "@eris/data"
import { currentLocale } from "@eris/i18n"

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

export const longDay = (day: Date) =>
  day.toLocaleDateString(currentLocale(), {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })

export const dateLabel = (day: Date, today: Date) =>
  day.toLocaleDateString(currentLocale(), {
    year: day.getFullYear() === today.getFullYear() ? undefined : "numeric",
    month: "long",
    day: "numeric",
  })

export const dayPeriod = (hour: number) =>
  new Intl.DateTimeFormat(currentLocale(), { hour: "numeric", hour12: true })
    .formatToParts(new Date(2000, 0, 1, hour))
    .find(part => part.type === "dayPeriod")?.value ?? ""

export const eventSpan = (event: CalendarEvent, allDayLabel: string) => {
  const start = parseLocal(event.start)
  const end = parseLocal(event.end)
  const sameDay = dateKey(start) === dateKey(end)

  if (event.allDay) {
    return sameDay ? allDayLabel : `${shortDay(start)} – ${shortDay(end)}`
  }

  if (openEnded(event)) {
    return clock(event.start)
  }

  if (sameDay) {
    return `${clock(event.start)} – ${clock(event.end)}`
  }

  return `${shortDay(start)} ${clock(event.start)} – ${shortDay(end)} ${clock(event.end)}`
}
