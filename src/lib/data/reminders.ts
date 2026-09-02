import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification"
import type { Profile } from "../settings"
import { formatRange, parseLocal, upcoming } from "./calendar"
import type { CalendarEvent } from "./types"

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

const check = async (events: CalendarEvent[]) => {
  const now = Date.now()
  const since = Math.max(lastTick, now - CATCH_UP)
  lastTick = now

  const due = upcoming(events, new Date(since), LOOKAHEAD_DAYS).filter(e => {
    const at = remindAt(e)

    return (
      at !== null && at > since && at <= now && !fired.has(`${e.id}@${e.start}`)
    )
  })

  if (due.length === 0 || !(await ensurePermission())) {
    return
  }

  for (const e of due) {
    fired.add(`${e.id}@${e.start}`)
    sendNotification({ title: e.title, body: formatRange(e) })
  }
}

export const scheduleReminders = (
  events: CalendarEvent[],
  _profile: Profile,
) => {
  check(events)

  const timer = setInterval(() => check(events), TICK)

  return () => clearInterval(timer)
}
