import { parseLocal, startOfDay } from "$lib/data/calendar"

const DAY = 86_400_000

export const rangeError = (start: string, end: string) => {
  const from = parseLocal(start).getTime()
  const to = parseLocal(end).getTime()

  if (Number.isNaN(from)) {
    return "Start date required"
  }

  if (Number.isNaN(to)) {
    return "End date required"
  }

  if (to < from) {
    return "End is before start"
  }

  return null
}

export const dayLabel = (day: Date, now = new Date()) => {
  const distance = Math.round(
    (startOfDay(day).getTime() - startOfDay(now).getTime()) / DAY,
  )

  if (distance === 0) {
    return "Today"
  }

  if (distance === 1) {
    return "Tomorrow"
  }

  if (distance === -1) {
    return "Yesterday"
  }

  return day.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export const longDate = (day: Date) =>
  day.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
