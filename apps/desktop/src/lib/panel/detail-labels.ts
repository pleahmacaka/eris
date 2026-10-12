import { addDays, parseLocal } from "@eris/data"
import { dateLabel, dayPeriod } from "#lib/calendar/index.js"
import type { Draft } from "./draft"

type Translate = (
  key: string,
  options?: { values: Record<string, string | number> },
) => string

export const reminderLabel = (minutes: number | null, t: Translate) => {
  if (minutes === null) {
    return t("common.none")
  }

  if (minutes === 0) {
    return t("panel.event.reminders.atStart")
  }

  if (minutes === 60) {
    return t("panel.event.reminders.hourBefore")
  }

  if (minutes === 1440) {
    return t("panel.event.reminders.dayBefore")
  }

  return t("panel.event.reminders.minutesBefore", {
    values: { count: minutes },
  })
}

const spoken = (time: string, t: Translate) => {
  const [hour, minute] = time.split(":").map(Number)
  const values = {
    period: dayPeriod(hour),
    hour: hour % 12 || 12,
    minute,
    padded: String(minute).padStart(2, "0"),
  }

  return t(minute === 0 ? "panel.clock.hour" : "panel.clock.minute", { values })
}

const repeatDate = (
  draft: Draft,
  date: Date,
  today: Date,
  locale: string,
  t: Translate,
) => {
  switch (draft.recurrence) {
    case "daily":
    case "weekdays":
      return t(`panel.event.every.${draft.recurrence}`)
    case "weekly":
      return t("panel.event.every.weekly", {
        values: { date: date.toLocaleDateString(locale, { weekday: "long" }) },
      })
    case "monthly":
      return t("panel.event.every.monthly", {
        values: { date: date.toLocaleDateString(locale, { day: "numeric" }) },
      })
    case "yearly":
      return t("panel.event.every.yearly", {
        values: {
          date: date.toLocaleDateString(locale, {
            month: "long",
            day: "numeric",
          }),
        },
      })
    default:
      return dateLabel(date, today)
  }
}

export const whenLabel = (
  draft: Draft,
  today: Date,
  locale: string,
  t: Translate,
) => {
  const day = parseLocal(draft.date)
  const date = repeatDate(draft, day, today, locale, t)
  const lastDay =
    draft.days > 0 && draft.recurrence === "none"
      ? dateLabel(addDays(day, draft.days), today)
      : null

  if (draft.allDay) {
    return lastDay ? `${date} – ${lastDay}` : date
  }

  const start = `${date} ${spoken(draft.start, t)}`

  if (!draft.hasEnd) {
    return start
  }

  return lastDay
    ? `${start} – ${lastDay} ${spoken(draft.end, t)}`
    : `${start} – ${spoken(draft.end, t)}`
}
