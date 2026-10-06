import {
  type CalendarEvent,
  type HolidayCheck,
  isDone,
  parseLocal,
  upcoming,
} from "@eris/data"
import { tr } from "@eris/i18n"
import type { Profile } from "@eris/settings"
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification"
import { eventSpan, hiddenWhileSharing, holidayCheck } from "$lib/calendar"

const TICK = 30_000
const CATCH_UP = 5 * 60_000
const LOOKAHEAD_DAYS = 2

const fired = new Set<string>()
let lastTick = Date.now()

const ensurePermission = async () => {
  if (await isPermissionGranted()) {
    return true
  }

  return (await requestPermission()) === "granted"
}

const remindAt = (e: CalendarEvent) =>
  e.allDay || e.reminderMinutes === null
    ? null
    : parseLocal(e.start).getTime() - e.reminderMinutes * 60_000

const check = async (
  events: CalendarEvent[],
  hidden: (e: CalendarEvent) => boolean,
  isHoliday: HolidayCheck,
) => {
  const now = Date.now()
  const since = Math.max(lastTick, now - CATCH_UP)
  lastTick = now

  const window = upcoming(events, new Date(since), LOOKAHEAD_DAYS, isHoliday)
  const due = window.filter(e => {
    const at = remindAt(e)

    return (
      at !== null &&
      at > since &&
      at <= now &&
      !isDone(e) &&
      !fired.has(`${e.id}@${e.start}`)
    )
  })

  if (due.length === 0 || !(await ensurePermission())) {
    return
  }

  for (const e of due) {
    fired.add(`${e.id}@${e.start}`)
    sendNotification(
      hidden(e)
        ? { title: tr("panel.privateReminder") }
        : { title: e.title, body: eventSpan(e, tr("panel.allDay")) },
    )
  }
}

export const scheduleReminders = (
  events: CalendarEvent[],
  calendar: Profile["calendar"],
  sharing: boolean,
) => {
  const hidden = sharing ? hiddenWhileSharing(calendar.tags) : () => false
  const isHoliday = holidayCheck(calendar)
  const run = () => check(events, hidden, isHoliday)

  run()

  const timer = setInterval(run, TICK)

  return () => clearInterval(timer)
}
