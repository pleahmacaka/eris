import { currentLocale } from "@eris/i18n"
import {
  type DeviceSettings,
  defaultDevice,
  defaultProfile,
  loadProfile,
  onDevice,
  onProfile,
  type Profile,
} from "@eris/settings"
import {
  blueSaturday,
  hiddenWhileSharing,
  holidayCheck,
  holidaysOn,
  regionOf,
  restDayOf,
} from "$lib/calendar"
import {
  addDays,
  type CalendarEvent,
  dateKey,
  dayDelta,
  editOccurrence,
  events,
  eventsByDay,
  eventsOn,
  isDone,
  live,
  monthGrid,
  newId,
  notes,
  type Occurrence,
  occurrenceAt,
  occurrenceKey,
  parseLocal,
  removeOccurrence,
  type Scope,
  startOfDay,
  updateProfileSynced,
  withDone,
} from "$lib/data"
import { ensureDevice } from "$lib/device"
import * as native from "$lib/native"

export type View =
  | { kind: "day" }
  | { kind: "notes" }
  | { kind: "event"; id: string; date: string | null }
  | { kind: "new"; day: Date; span: number; parent: string | null }

export type ScopeMode = "edit" | "delete"

type Asking = {
  mode: ScopeMode
  scoped: boolean
  answer: (scope: Scope | null) => void
}

const GRID_DAYS = 42

const byStart = (a: CalendarEvent, b: CalendarEvent) =>
  parseLocal(a.start).getTime() - parseLocal(b.start).getTime()

export class Panel {
  profile = $state<Profile>(defaultProfile)

  device = $state<DeviceSettings>(defaultDevice)

  sharing = $state(false)

  now = $state(new Date())

  cursor = $state(startOfDay(new Date()))

  selected = $state(startOfDay(new Date()))

  view = $state<View>({ kind: "day" })

  asking = $state<Asking | null>(null)

  eventLive = live(events)

  noteLive = live(notes)

  today = $derived(startOfDay(this.now))

  calendarOn = $derived(this.device.features.calendar)

  anchorTop = $derived(
    this.device.dockEdge === "top" ||
      (this.device.topBar && this.device.features.dock),
  )

  weeks = $derived(
    monthGrid(
      this.cursor.getFullYear(),
      this.cursor.getMonth(),
      this.profile.calendar.weekStartsOn,
    ),
  )

  month = $derived(this.cursor.getMonth())

  monthLabel = $derived(
    this.cursor.toLocaleDateString(currentLocale(), {
      year: "numeric",
      month: "long",
    }),
  )

  shown = $derived.by(() => {
    if (!this.sharing) {
      return this.eventLive.items
    }

    const hidden = hiddenWhileSharing(this.profile.calendar.tags)

    return this.eventLive.items.filter(e => !hidden(e))
  })

  concealedCount = $derived(this.eventLive.items.length - this.shown.length)

  region = $derived(regionOf(this.profile.calendar))

  isHoliday = $derived(holidayCheck(this.profile.calendar))

  restDay = $derived(restDayOf(this.region))

  saturdayBlue = $derived(blueSaturday(this.region))

  byDay = $derived(
    eventsByDay(this.shown, this.weeks[0][0], GRID_DAYS, this.isHoliday),
  )

  orderedDay = (day: Date) => {
    const list = eventsOn(this.shown, day, this.isHoliday)
    const allDay = list
      .filter(e => e.allDay)
      .sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))

    return [...allDay, ...list.filter(e => !e.allDay)]
  }

  dayEvents = $derived(this.orderedDay(this.selected))

  range = $derived(
    this.view.kind === "new" && this.view.span > 0
      ? ([this.view.day, addDays(this.view.day, this.view.span)] as const)
      : null,
  )

  openEvent = $derived.by((): Occurrence | null => {
    const view = this.view

    if (view.kind !== "event") {
      return null
    }

    const found = this.shown.find(e => e.id === view.id)

    if (!found || found.recurrence === "none" || !view.date) {
      return found ?? null
    }

    return occurrenceAt(found, view.date, this.isHoliday)
  })

  detailOpen = $derived(this.view.kind === "new" || this.openEvent !== null)

  eventsOn = (day: Date) => this.byDay.get(dateKey(day)) ?? []

  holidayFor = (day: Date) =>
    holidaysOn(day, this.region, currentLocale().split("-")[0])

  weekdayTone = (day: Date) =>
    day.getDay() === this.restDay
      ? "text-error"
      : this.saturdayBlue && day.getDay() === 6
        ? "text-info"
        : null

  dayTone = (day: Date) =>
    this.isHoliday(day) ? "text-error" : this.weekdayTone(day)

  parentOf = (event: CalendarEvent) =>
    event.parentId ? this.shown.find(e => e.id === event.parentId) : undefined

  childrenOf = (event: CalendarEvent) =>
    this.shown.filter(e => e.parentId === event.id).sort(byStart)

  hasChildren = (event: CalendarEvent) =>
    this.eventLive.items.some(e => e.parentId === event.id)

  isRoot = (event: CalendarEvent) =>
    !event.parentId || !this.eventLive.items.some(e => e.id === event.parentId)

  go = (view: View) => {
    this.asking?.answer(null)
    this.view = view
  }

  close = () => this.go({ kind: "day" })

  shift = (months: number) => {
    this.cursor = new Date(
      this.cursor.getFullYear(),
      this.cursor.getMonth() + months,
      1,
    )
  }

  jumpToday = () => {
    this.cursor = startOfDay(this.now)
    this.selected = startOfDay(this.now)
    this.close()
  }

  reset = () => {
    this.now = new Date()
    this.jumpToday()
  }

  pick = (day: Date) => {
    this.selected = day
    this.close()

    if (day.getMonth() !== this.cursor.getMonth()) {
      this.cursor = new Date(day.getFullYear(), day.getMonth(), 1)
    }
  }

  show = (event: Occurrence) =>
    this.go({
      kind: "event",
      id: event.id,
      date:
        event.seriesDate ??
        (event.recurrence === "none" ? null : dateKey(parseLocal(event.start))),
    })

  // a field edit keeps the detail open; a series split hands the occurrence a new record
  private reveal = (event: CalendarEvent) =>
    this.go({
      kind: "event",
      id: event.id,
      date:
        event.recurrence === "none" ? null : dateKey(parseLocal(event.start)),
    })

  createEvent = async (next: CalendarEvent) => {
    await events.put(next)
    this.reveal(next)
  }

  commitEvent = async (
    occurrence: Occurrence,
    next: CalendarEvent,
    scope: Scope | null,
  ) => {
    if (!occurrence.seriesDate || !scope) {
      await events.put(next)

      return
    }

    const edited = await editOccurrence(occurrence, next, scope)

    if (edited) {
      this.reveal({ ...edited, start: next.start })
    }
  }

  startNew = () =>
    this.go({ kind: "new", day: this.selected, span: 0, parent: null })

  startChild = (parent: CalendarEvent) => {
    this.selected = startOfDay(parseLocal(parent.start))
    this.go({ kind: "new", day: this.selected, span: 0, parent: parent.id })
  }

  startRange = (start: Date, end: Date) => {
    this.selected = start
    this.go({
      kind: "new",
      day: start,
      span: dayDelta(dateKey(start), dateKey(end)),
      parent: null,
    })
  }

  showNotes = () => this.go({ kind: "notes" })

  askScope = (mode: ScopeMode, scoped = true) =>
    new Promise<Scope | null>(resolve => {
      this.asking?.answer(null)
      this.asking = {
        mode,
        scoped,
        answer: scope => {
          this.asking = null
          resolve(scope)
        },
      }
    })

  reorderDay = async (fromId: string, toId: string, after: boolean) => {
    if (fromId === toId) {
      return
    }

    const allDay = this.dayEvents.filter(e => e.allDay)
    const from = allDay.findIndex(e => e.id === fromId)

    if (from < 0 || !allDay.some(e => e.id === toId)) {
      return
    }

    const next = [...allDay]
    const [moved] = next.splice(from, 1)
    const target = next.findIndex(e => e.id === toId)

    next.splice(after ? target + 1 : target, 0, moved)

    await Promise.all(
      next.map((occ, index) => {
        const base = this.shown.find(e => e.id === occ.id)

        return base && base.order !== index
          ? events.put({ ...base, order: index, updatedAt: Date.now() })
          : null
      }),
    )
  }

  remove = async (event: Occurrence) => {
    if (event.seriesDate) {
      const scope = await this.askScope("delete")

      if (!scope) {
        return
      }

      await removeOccurrence(event, scope)
    } else {
      if (!(await this.askScope("delete", false))) {
        return
      }

      await events.remove(event.id)
    }

    this.close()
  }

  createTag = (name: string) => {
    const tag = { id: newId(), name, hideWhileSharing: false }

    this.profile.calendar.tags = [...this.profile.calendar.tags, tag]
    updateProfileSynced(p => ({
      ...p,
      calendar: { ...p.calendar, tags: [...p.calendar.tags, tag] },
    }))

    return tag.id
  }

  toggleDone = async (event: Occurrence) => {
    const stored = await events.get(event.id)

    if (stored) {
      await events.put(
        withDone(stored, occurrenceKey(event), !isDone(event), Date.now()),
      )
    }
  }

  start = () => {
    ensureDevice()
      .then(d => {
        this.device = d
      })
      .catch(() => undefined)
    loadProfile().then(p => {
      this.profile = p
    })

    const stops = [
      onProfile(p => {
        this.profile = p
      }),
      onDevice(d => {
        this.device = d
      }),
      native.watchScreenShare(value => {
        this.sharing = value
      }),
    ]

    const clock = setInterval(() => {
      this.now = new Date()
    }, 60_000)

    return () => {
      clearInterval(clock)

      for (const stop of stops) {
        stop.then(fn => fn())
      }

      this.eventLive.stop()
      this.noteLive.stop()
    }
  }
}
