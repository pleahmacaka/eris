import { expect, mock, test } from "bun:test"
import type { Timer } from "./timers"

const data = new Map<string, unknown>()

mock.module("@tauri-apps/plugin-store", () => ({
  load: async () => ({
    get: async (key: string) => data.get(key),
    set: async (key: string, value: unknown) => {
      data.set(key, value)
    },
    save: async () => undefined,
  }),
}))

const emitted: string[] = []

mock.module("@tauri-apps/api/event", () => ({
  emit: async (name: string) => {
    emitted.push(name)
  },
  listen: async () => () => undefined,
}))

let sent: string[] = []
let failNotify = false

mock.module("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: async () => true,
  requestPermission: async () => "granted",
  sendNotification: (options: { title: string; body: string }) => {
    if (failNotify) {
      throw new Error("notification failed")
    }

    sent.push(options.body)
  },
}))

const {
  addTimer,
  cancelTimer,
  subscribeTimers,
  loadTimers,
  tickTimers,
  TIMER_EVENT,
} = await import("./timers")

const NOW = Date.now()

const timer = (id: string, fireAt: number): Timer => ({
  id,
  fireAt,
  label: id,
  kind: "timer",
})

const stored = () => (data.get("timers") ?? []) as Timer[]

const ids = () => stored().map(t => t.id)

const write = (items: Timer[]) => data.set("timers", items)

const seen: Timer[][] = []

test("load drops timers that expired while the app was closed", async () => {
  write([
    timer("stale", NOW - 300_000),
    timer("due", NOW - 2_000),
    timer("later", NOW + 600_000),
  ])

  subscribeTimers(items => {
    seen.push(items)
  })
  await loadTimers()

  expect(ids()).toEqual(["due", "later"])
  expect(seen.at(-1)?.map(t => t.id)).toEqual(["due", "later"])
})

test("adding keeps a timer another window wrote meanwhile", async () => {
  write([...stored(), timer("other-window", NOW + 900_000)])

  await addTimer({ label: "toast", kind: "timer", fireAt: NOW + 5_000 })

  expect(ids()).toContain("other-window")
  expect(stored()).toHaveLength(4)
  expect(emitted).toContain(TIMER_EVENT)
})

test("adding does not resurrect a timer cancelled in another window", async () => {
  write(stored().filter(t => t.id !== "later"))

  await addTimer({ label: "coffee", kind: "timer", fireAt: NOW + 7_000 })

  expect(ids()).not.toContain("later")
  expect(stored()).toHaveLength(4)
})

test("cancelling removes only that timer", async () => {
  await cancelTimer("other-window")

  expect(ids()).not.toContain("other-window")
  expect(stored()).toHaveLength(3)
})

test("a timer fires once even when two ticks run at the same time", async () => {
  sent = []

  await Promise.all([tickTimers(), tickTimers()])

  expect(sent).toEqual(["due"])
  expect(ids()).not.toContain("due")

  await tickTimers()

  expect(sent).toEqual(["due"])
})

test("one tick fires every timer that came due while the interval stalled", async () => {
  sent = []
  write([
    timer("first", NOW - 30_000),
    timer("second", NOW - 20_000),
    timer("third", NOW - 10_000),
    timer("pending", NOW + 600_000),
  ])

  await tickTimers()

  expect(sent).toEqual(["first", "second", "third"])
  expect(ids()).toEqual(["pending"])
})

test("a failed notification puts the timer back and retries", async () => {
  sent = []
  failNotify = true
  write([timer("flaky", NOW - 1_000)])

  await tickTimers()

  expect(ids()).toEqual(["flaky"])
  expect(sent).toEqual([])

  failNotify = false
  await tickTimers()

  expect(sent).toEqual(["flaky"])
  expect(ids()).toEqual([])
})
