import { afterAll, expect, mock, setSystemTime, test } from "bun:test"
import type { CalendarEvent } from "@eris/data"
import { defaultProfile } from "@eris/settings"

const sent: string[] = []

mock.module("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: async () => true,
  requestPermission: async () => "granted",
  sendNotification: (n: { title: string }) => {
    sent.push(n.title)
  },
}))

setSystemTime(new Date(2026, 8, 2, 10, 0, 5))

const { scheduleReminders } = await import("./reminders")

const calendarWith = (reminderMinutes: number) => ({
  ...defaultProfile.calendar,
  reminderMinutes,
})

const event = (over: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e",
  title: "e",
  notes: "",
  start: "2026-09-02T10:01",
  end: "2026-09-02T11:00",
  allDay: false,
  color: null,
  reminderMinutes: null,
  recurrence: "none",
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const settle = () => new Promise(r => setTimeout(r, 20))

afterAll(() => setSystemTime())

test("settings default 'None' (0) still notifies at event start", async () => {
  setSystemTime(new Date(2026, 8, 2, 10, 1, 10))

  const stop = scheduleReminders(
    [event({ id: "a", title: "a", start: "2026-09-02T10:01" })],
    calendarWith(0),
    false,
  )

  await settle()
  stop()

  expect(sent).not.toContain("a")
})

test("editor 'None' (null) still notifies with the profile default", async () => {
  setSystemTime(new Date(2026, 8, 2, 10, 2, 10))

  const stop = scheduleReminders(
    [event({ id: "b", title: "b", start: "2026-09-02T10:12" })],
    calendarWith(10),
    false,
  )

  await settle()
  stop()

  expect(sent).not.toContain("b")
})

test("explicit minutes fire, zero fires at the start", async () => {
  setSystemTime(new Date(2026, 8, 2, 10, 3, 10))

  const stop = scheduleReminders(
    [
      event({
        id: "c",
        title: "c",
        start: "2026-09-02T10:13",
        reminderMinutes: 10,
      }),
      event({
        id: "d",
        title: "d",
        start: "2026-09-02T10:03",
        reminderMinutes: 0,
      }),
    ],
    calendarWith(0),
    false,
  )

  await settle()
  stop()

  expect(sent).toEqual(["d", "c"])
})
