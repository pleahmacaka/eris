import { currentLocale } from "@eris/i18n"
import {
  type DeviceSettings,
  defaultDevice,
  defaultProfile,
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
  type CalendarEvent,
  dateKey,
  dayDelta,
  editOccurrence,
  events,
  eventsByDay,
  eventsOn,
  inSeries,
  live,
  monthGrid,
  newId,
  notes,
  type Occurrence,
  parseLocal,
  removeOccurrence,
  startOfDay,
  updateProfileSynced,
} from "$lib/data"
import { colorMeta, toColor } from "./colors"
import type { Draft } from "./draft"
import { panelMutations } from "./mutations"
import {
  childrenOf,
  daySections,
  openOccurrence,
  orderedDay,
  rangeTone,
  selectedRange,
} from "./projections"
import { type ScopeMode, ScopePrompt } from "./scope.svelte"
import { subscribePanel } from "./subscriptions"

export type View =
  | { kind: "day" }
  | { kind: "notes" }
  | { kind: "event"; id: string; date: string | null }
  | { kind: "new"; day: Date; span: number; parent: string | null }

export type { ScopeMode } from "./scope.svelte"

const GRID_DAYS = 42

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

  private scopePrompt = new ScopePrompt()

  get asking() {
    return this.scopePrompt.asking
  }

  set asking(value: ScopePrompt["asking"]) {
    this.scopePrompt.asking = value
  }

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

  orderedDay = (day: Date) => orderedDay(this.shown, day, this.isHoliday)

  dayEvents = $derived(this.orderedDay(this.selected))

  range = $derived(selectedRange(this.selected, this.rangeEnd, this.drag))

  daySections = $derived(
    daySections(this.selected, this.rangeEnd, this.orderedDay),
  )

  inRange = (day: Date) =>
    this.range !== null && day >= this.range[0] && day <= this.range[1]

  rangeTone = (day: Date) =>
    rangeTone(day, this.range, this.profile.calendar.weekStartsOn)

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

  openEvent = $derived(
    openOccurrence(this.eventLive.items, this.view, this.isHoliday),
  )

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

  childrenOf = (event: CalendarEvent) => childrenOf(this.shown, event)

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

  private mutations = panelMutations(this, this.reveal, {
    events,
    editOccurrence,
    removeOccurrence,
    updateProfileSynced,
    newId,
  })

  createEvent = this.mutations.createEvent

  commitEvent = this.mutations.commitEvent

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

  groupWith = this.mutations.groupWith

  ungroup = this.mutations.ungroup

  groupOf = (event: CalendarEvent) =>
    event.group ? this.shown.filter(e => e.group === event.group) : []

  askScope = (mode: ScopeMode, scoped = true) =>
    this.scopePrompt.ask(mode, scoped)

  reorderDay = this.mutations.reorderDay

  remove = this.mutations.remove

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

  createTag = this.mutations.createTag

  updateTag = this.mutations.updateTag

  removeTag = this.mutations.removeTag

  toggleDone = this.mutations.toggleDone

  start = () => subscribePanel(this)
}
