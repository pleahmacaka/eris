import { emit, listen } from "@tauri-apps/api/event"
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification"
import { load } from "@tauri-apps/plugin-store"

export type TimerKind = "timer" | "alarm"

export type Timer = {
  id: string
  label: string
  fireAt: number
  kind: TimerKind
}

export const TIMER_EVENT = "timers-changed"

const FILE = "launcher.json"
const KEY = "timers"
const TICK = 1000
const STALE = 60_000

const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

const SEGMENT =
  /^\s*(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|[smhd])?(?![a-z])/i

const CLOCK = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b\s*/i

export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const parts = [
    hours ? `${hours}h` : "",
    minutes ? `${minutes}m` : "",
    !hours && seconds ? `${seconds}s` : "",
  ].filter(Boolean)

  return parts.length ? parts.join(" ") : "0s"
}

export const formatClock = (at: number) =>
  new Date(at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })

export const remaining = (timer: Timer, now = Date.now()) =>
  formatDuration(timer.fireAt - now)

const parseDuration = (text: string) => {
  let rest = text
  let total = 0
  let matched = false

  for (;;) {
    const segment = SEGMENT.exec(rest)

    if (!segment) {
      break
    }

    const unit = (segment[2] ?? "m")[0].toLowerCase()

    total += Number(segment[1]) * UNIT_MS[unit]
    rest = rest.slice(segment[0].length)
    matched = true

    if (!/^\s*\d/.test(rest)) {
      break
    }
  }

  return matched && total > 0 ? { ms: total, rest: rest.trim() } : null
}

const parseClock = (text: string, now: number) => {
  const match = CLOCK.exec(text)

  if (!match) {
    return null
  }

  const meridiem = match[3]?.toLowerCase()
  const raw = Number(match[1])
  const minute = Number(match[2] ?? 0)
  const hour =
    meridiem === "pm" ? (raw % 12) + 12 : meridiem === "am" ? raw % 12 : raw

  if (hour > 23 || minute > 59) {
    return null
  }

  const at = new Date(now)

  at.setHours(hour, minute, 0, 0)

  if (at.getTime() <= now) {
    at.setDate(at.getDate() + 1)
  }

  return { fireAt: at.getTime(), rest: text.slice(match[0].length).trim() }
}

export const parseTimer = (
  text: string,
  kind: TimerKind,
  now = Date.now(),
): Omit<Timer, "id"> | null => {
  const input = text.trim()

  if (!input) {
    return null
  }

  if (kind === "alarm" || /^\d{1,2}:\d{2}/.test(input)) {
    const clock = parseClock(input, now)

    return clock
      ? {
          kind,
          label: clock.rest || formatClock(clock.fireAt),
          fireAt: clock.fireAt,
        }
      : null
  }

  const duration = parseDuration(input)

  return duration
    ? {
        kind,
        label: duration.rest || formatDuration(duration.ms),
        fireAt: now + duration.ms,
      }
    : null
}

let timers: Timer[] = []
let loaded: Promise<void> | undefined
let bridge: Promise<unknown> | undefined
let watch: (() => void) | undefined
let queue: Promise<unknown> = Promise.resolve()
let ticking = false
let pulse: ReturnType<typeof setInterval> | undefined

const listeners = new Set<(items: Timer[]) => void>()
const fired = new Set<string>()

const notify = () => {
  for (const listener of listeners) {
    listener([...timers])
  }

  managePulse()
}

const managePulse = () => {
  const wanted = listeners.size > 0 && timers.length > 0

  if (wanted && !pulse) {
    pulse = setInterval(notify, TICK)
  }

  if (!wanted && pulse) {
    clearInterval(pulse)
    pulse = undefined
  }
}

const read = async () => {
  const store = await load(FILE)

  return (await store.get<Timer[]>(KEY)) ?? []
}

const apply = async (change: (items: Timer[]) => Timer[]) => {
  const store = await load(FILE)
  const next = change((await store.get<Timer[]>(KEY)) ?? [])

  await store.set(KEY, next)
  await store.save()

  timers = next
  notify()
  await emit(TIMER_EVENT)
}

const mutate = (change: (items: Timer[]) => Timer[]) => {
  const done = queue.then(() => apply(change))

  queue = done.catch(() => undefined)

  return done
}

const refresh = async () => {
  timers = await read()
  notify()
}

const connect = () => {
  bridge ??= listen(TIMER_EVENT, () => {
    refresh()
  })

  return bridge
}

export const loadTimers = () => {
  loaded ??= mutate(items => items.filter(t => t.fireAt > Date.now() - STALE))
    .then(() => undefined)
    .catch(() => undefined)

  return loaded
}

export const subscribeTimers = (handler: (items: Timer[]) => void) => {
  listeners.add(handler)
  handler([...timers])
  managePulse()
  connect()
  loadTimers()

  return () => {
    listeners.delete(handler)
    managePulse()
  }
}

export const addTimer = (draft: Omit<Timer, "id">) => {
  const timer = { ...draft, id: crypto.randomUUID() }

  return mutate(items => [...items, timer])
}

export const cancelTimer = (id: string) =>
  mutate(items => items.filter(t => t.id !== id))

const announce = async (due: Timer[]) => {
  const allowed =
    (await isPermissionGranted()) || (await requestPermission()) === "granted"

  if (!allowed) {
    return
  }

  for (const timer of due) {
    sendNotification({
      title: timer.kind === "alarm" ? "Alarm" : "Timer",
      body: timer.label,
    })
  }
}

const fire = async (due: Timer[]) => {
  const ids = new Set(due.map(t => t.id))

  for (const id of ids) {
    fired.add(id)
  }

  await mutate(items => items.filter(t => !ids.has(t.id)))

  try {
    await announce(due)
  } catch {
    for (const id of ids) {
      fired.delete(id)
    }

    await mutate(items => [
      ...items,
      ...due.filter(t => !items.some(i => i.id === t.id)),
    ])
  }
}

export const tickTimers = async () => {
  if (ticking) {
    return
  }

  ticking = true

  try {
    const now = Date.now()
    const due = (await read()).filter(t => t.fireAt <= now && !fired.has(t.id))

    if (due.length) {
      await fire(due)
    }
  } catch {
    return
  } finally {
    ticking = false
  }
}

export const startTimerWatch = () => {
  if (watch) {
    return watch
  }

  loadTimers()
  connect()

  const interval = setInterval(tickTimers, TICK)

  watch = () => {
    clearInterval(interval)
    watch = undefined
  }

  return watch
}
