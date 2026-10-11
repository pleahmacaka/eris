import type { CalendarEvent } from "@eris/data"

export const eventFixture = (
  patch: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  id: "event",
  title: "Meeting",
  notes: "",
  start: "2026-03-07",
  end: "2026-03-09",
  allDay: true,
  color: null,
  reminderMinutes: null,
  recurrence: "none",
  createdAt: 10,
  updatedAt: 20,
  ...patch,
})

// Setting TZ at runtime also works on Windows, where shell prefixes may be lost.
export const inTimezone = <T>(timezone: string, run: () => T): T => {
  const previous = process.env.TZ
  const system = Intl.DateTimeFormat().resolvedOptions().timeZone

  process.env.TZ = timezone

  try {
    return run()
  } finally {
    process.env.TZ = previous ?? system

    if (previous === undefined) {
      delete process.env.TZ
    }
  }
}
