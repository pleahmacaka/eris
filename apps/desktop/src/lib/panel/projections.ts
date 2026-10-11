import {
  addDays,
  type CalendarEvent,
  dateKey,
  dayDelta,
  eventsOn,
  type Occurrence,
  occurrenceAt,
  parseLocal,
} from "@eris/data"
import type { View } from "./panel.svelte"

export type DayRange = [Date, Date]

export const selectedRange = (
  selected: Date,
  end: Date | null,
  drag: { from: Date; to: Date } | null,
): DayRange | null => {
  if (drag) {
    return drag.from <= drag.to ? [drag.from, drag.to] : [drag.to, drag.from]
  }

  return end ? [selected, end] : null
}

export const rangeTone = (
  day: Date,
  range: DayRange | null,
  weekStartsOn: number,
) => {
  if (!range || day < range[0] || day > range[1]) {
    return null
  }

  const column = (day.getDay() - weekStartsOn + 7) % 7
  const first = column === 0 || dateKey(day) === dateKey(range[0])
  const last = column === 6 || dateKey(day) === dateKey(range[1])

  return [
    "bg-primary/15",
    !first && "-ml-0.5 rounded-l-none",
    !last && "-mr-0.5 rounded-r-none",
  ]
}

export const orderedDay = (
  shown: CalendarEvent[],
  day: Date,
  isHoliday: (day: Date) => boolean,
) => {
  const list = eventsOn(shown, day, isHoliday)
  const allDay = list
    .filter(e => e.allDay)
    .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))

  return [...allDay, ...list.filter(e => !e.allDay)]
}

// A spanning event appears once in a range, but separate recurring dates remain.
export const daySections = (
  selected: Date,
  end: Date | null,
  ordered: (day: Date) => Occurrence[],
) => {
  if (!end) {
    return [{ day: selected, events: ordered(selected) }]
  }

  const seen = new Set<string>()
  const length = dayDelta(dateKey(selected), dateKey(end)) + 1

  return Array.from({ length }, (_, index) => {
    const day = addDays(selected, index)
    const events = ordered(day).filter(e => {
      const fresh = !seen.has(e.id + e.start)

      seen.add(e.id + e.start)

      return fresh
    })

    return { day, events }
  })
}

export const openOccurrence = (
  items: CalendarEvent[],
  view: View,
  isHoliday: (day: Date) => boolean,
): Occurrence | null => {
  if (view.kind !== "event") {
    return null
  }

  const found = items.find(e => e.id === view.id)

  if (!found || found.recurrence === "none" || !view.date) {
    return found ?? null
  }

  return occurrenceAt(found, view.date, isHoliday)
}

export const childrenOf = (shown: CalendarEvent[], event: CalendarEvent) =>
  shown
    .filter(e => e.parentId === event.id)
    .sort(
      (a, b) => parseLocal(a.start).getTime() - parseLocal(b.start).getTime(),
    )
