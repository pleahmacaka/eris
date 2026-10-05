import { parseLocal } from "$lib/data/calendar"
import type { CalendarEvent } from "$lib/data/types"

export const clock = (value: string) =>
  parseLocal(value).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

export const eventTime = (event: CalendarEvent) =>
  event.allDay ? "종일" : clock(event.start)

export const eventSpan = (event: CalendarEvent) => {
  if (event.allDay) {
    return "종일"
  }

  return `${clock(event.start)} – ${clock(event.end)}`
}

export const longDay = (day: Date) =>
  day.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  })
