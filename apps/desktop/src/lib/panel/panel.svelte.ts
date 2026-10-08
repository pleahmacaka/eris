import { currentLocale } from "@eris/i18n"
import {
  type DeviceSettings,
  defaultDevice,
  defaultProfile,
  type EventTag,
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
  loadHolidays,
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
  inSeries,
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
import { colorMeta, eventColors, toColor } from "./colors"
import type { Draft } from "./draft"

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

  rangeEnd = $state<Date | null>(null)

  drag = $state<{ from: Date; to: Date } | null>(null)

  asking = $state<Asking | null>(null)

  kept: { key: string; draft: Draft } | null = null

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

  revealedDays = $state<string[]>([])

  private concealed = $derived.by(() => {
    if (!this.sharing) {
      return []
    }

    const hidden = hiddenWhileSharing(this.profile.calendar.tags)

    return this.eventLive.items.filter(hidden)
  })

  shown = $derived(
    this.concealed.length === 0
      ? this.eventLive.items
      : this.eventLive.items.filter(e => !this.concealed.includes(e)),
  )

  hiddenOn = (day: Date) =>
    this.concealed.length === 0
      ? []
      : eventsOn(this.concealed, day, this.isHoliday)

  isRevealed = (day: Date) => this.revealedDays.includes(dateKey(day))

  toggleReveal = (day: Date) => {
    const key = dateKey(day)

    this.revealedDays = this.revealedDays.includes(key)
      ? this.revealedDays.filter(entry => entry !== key)
      : [...this.revealedDays, key]
  }

  region = $derived(regionOf(this.profile.calendar))

  holidaysReady = $state(false)

  isHoliday = $derived(
    this.holidaysReady ? holidayCheck(this.profile.calendar) : () => false,
  )

  restDay = $derived(this.holidaysReady ? restDayOf(this.region) : 0)

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

  range = $derived.by(() => {
    if (this.drag) {
      const { from, to } = this.drag

      return from <= to ? [from, to] : [to, from]
    }

    return this.rangeEnd ? [this.selected, this.rangeEnd] : null
  })

  daySections = $derived.by(() => {
    const end = this.rangeEnd

    if (!end) {
      return [{ day: this.selected, events: this.dayEvents }]
    }

    const seen = new Set<string>()
    const length = dayDelta(dateKey(this.selected), dateKey(end)) + 1

    return Array.from({ length }, (_, index) => {
      const day = addDays(this.selected, index)
      const events = this.orderedDay(day).filter(e => {
        const fresh = !seen.has(e.id + e.start)

        seen.add(e.id + e.start)

        return fresh
      })

      return { day, events }
    })
  })

  inRange = (day: Date) =>
    this.range !== null && day >= this.range[0] && day <= this.range[1]

  rangeTone = (day: Date) => {
    const range = this.range

    if (!range || day < range[0] || day > range[1]) {
      return null
    }

    const column = (day.getDay() - this.profile.calendar.weekStartsOn + 7) % 7
    const first = column === 0 || dateKey(day) === dateKey(range[0])
    const last = column === 6 || dateKey(day) === dateKey(range[1])

    return [
      "bg-primary/15",
      !first && "-ml-0.5 rounded-l-none",
      !last && "-mr-0.5 rounded-r-none",
    ]
  }

  beginDrag = (day: Date) => {
    this.drag = { from: day, to: day }
  }

  extendDrag = (day: Date) => {
    if (this.drag) {
      this.drag = { ...this.drag, to: day }
    }
  }

  endDrag = () => {
    const range = this.drag && this.range

    this.drag = null

    if (range && dateKey(range[0]) !== dateKey(range[1])) {
      this.startRange(range[0], range[1])
    }
  }

  openEvent = $derived.by((): Occurrence | null => {
    const view = this.view

    if (view.kind !== "event") {
      return null
    }

    const found = this.eventLive.items.find(e => e.id === view.id)

    if (!found || found.recurrence === "none" || !view.date) {
      return found ?? null
    }

    return occurrenceAt(found, view.date, this.isHoliday)
  })

  detailOpen = $derived(this.view.kind === "new" || this.openEvent !== null)

  eventsOn = (day: Date) => this.byDay.get(dateKey(day)) ?? []

  holidayFor = (day: Date) =>
    this.holidaysReady
      ? holidaysOn(day, this.region, currentLocale().split("-")[0])
      : []

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
    this.kept = null
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
    this.rangeEnd = null
    this.close()
  }

  reset = () => {
    this.now = new Date()
    this.jumpToday()
  }

  pick = (day: Date) => {
    this.selected = day
    this.rangeEnd = null
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

  private creating = false

  // the compact and expanded details can both commit one draft while the first write is in flight
  createEvent = async (next: CalendarEvent) => {
    if (this.creating) {
      return
    }

    this.creating = true

    try {
      await events.put(next)
      this.reveal(next)
    } finally {
      this.creating = false
    }
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
    this.go({
      kind: "new",
      day: this.selected,
      span: this.rangeEnd
        ? dayDelta(dateKey(this.selected), dateKey(this.rangeEnd))
        : 0,
      parent: null,
    })

  startChild = (parent: CalendarEvent) => {
    this.selected = startOfDay(parseLocal(parent.start))
    this.rangeEnd = null
    this.go({ kind: "new", day: this.selected, span: 0, parent: parent.id })
  }

  startRange = (start: Date, end: Date) => {
    this.selected = start
    this.rangeEnd = end
    this.go({
      kind: "new",
      day: start,
      span: dayDelta(dateKey(start), dateKey(end)),
      parent: null,
    })
  }

  showNotes = () =>
    this.go(this.view.kind === "notes" ? { kind: "day" } : { kind: "notes" })

  groupWith = async (moved: Occurrence, target: Occurrence) => {
    const group = target.group ?? moved.group ?? newId()
    const stored = await Promise.all([
      events.get(moved.id),
      events.get(target.id),
    ])
    const stamp = Date.now()

    await events.apply({
      put: stored.flatMap(e => (e ? [{ ...e, group, updatedAt: stamp }] : [])),
      remove: [],
    })
  }

  ungroup = async (event: Occurrence) => {
    const stored = await events.get(event.id)

    if (stored) {
      await events.put({ ...stored, group: null, updatedAt: Date.now() })
    }
  }

  groupOf = (event: CalendarEvent) =>
    event.group ? this.shown.filter(e => e.group === event.group) : []

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

  colorOf = (tagIds: string[] | undefined) =>
    toColor(
      this.profile.calendar.tags.find(
        tag => tag.color && (tagIds ?? []).includes(tag.id),
      )?.color,
    )

  dotTone = (event: CalendarEvent) => {
    const meta = colorMeta[this.colorOf(event.tags)]

    return inSeries(event) ? ["border", meta.ring] : meta.chip
  }

  private editTags = (edit: (tags: EventTag[]) => EventTag[]) => {
    this.profile.calendar.tags = edit(this.profile.calendar.tags)
    updateProfileSynced(p => ({
      ...p,
      calendar: { ...p.calendar, tags: edit(p.calendar.tags) },
    }))
  }

  createTag = (name: string) => {
    const count = this.profile.calendar.tags.length
    const tag = {
      id: newId(),
      name,
      hideWhileSharing: false,
      color: eventColors[count % eventColors.length],
    }

    this.editTags(tags => [...tags, tag])

    return tag.id
  }

  updateTag = (id: string, patch: Partial<EventTag>) =>
    this.editTags(tags =>
      tags.map(tag => (tag.id === id ? { ...tag, ...patch } : tag)),
    )

  removeTag = (id: string) =>
    this.editTags(tags => tags.filter(tag => tag.id !== id))

  toggleDone = async (event: Occurrence) => {
    const stored = await events.get(event.id)

    if (stored) {
      await events.put(
        withDone(stored, occurrenceKey(event), !isDone(event), Date.now()),
      )
    }
  }

  start = () => {
    loadHolidays().then(() => (this.holidaysReady = true))
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

        if (!value) {
          this.revealedDays = []
        }
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
