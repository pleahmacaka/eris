import { currentLocale, tr } from "@eris/i18n"
import { parseLocal, startOfDay } from "$lib/data"

const DAY = 86_400_000

export const rangeError = (start: string, end: string) => {
  const from = parseLocal(start).getTime()
  const to = parseLocal(end).getTime()

  if (Number.isNaN(from)) {
    return tr("panel.errors.startRequired")
  }

  if (Number.isNaN(to)) {
    return tr("panel.errors.endRequired")
  }

  if (to < from) {
    return tr("panel.errors.endBeforeStart")
  }

  return null
}

export const dayLabel = (day: Date, now = new Date()) => {
  const distance = Math.round(
    (startOfDay(day).getTime() - startOfDay(now).getTime()) / DAY,
  )

  if (distance === 0) {
    return tr("dates.today")
  }

  if (distance === 1) {
    return tr("dates.tomorrow")
  }

  if (distance === -1) {
    return tr("dates.yesterday")
  }

  return day.toLocaleDateString(currentLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export const longDate = (day: Date) =>
  day.toLocaleDateString(currentLocale(), {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
