import { afterAll, expect, mock, setSystemTime, test } from "bun:test"
import type { StoredRecord } from "../sync/protocol"
import type { Todo } from "./types"

const files = new Map<string, Map<string, unknown>>()

const file = (name: string) => {
  const existing = files.get(name)

  if (existing) {
    return existing
  }

  const created = new Map<string, unknown>()
  files.set(name, created)

  return created
}

mock.module("@tauri-apps/plugin-store", () => ({
  load: async (name: string) => {
    const data = file(name)

    return {
      get: async (key: string) => data.get(key),
      set: async (key: string, value: unknown) => {
        data.set(key, value)
      },
      delete: async (key: string) => data.delete(key),
      keys: async () => [...data.keys()],
      entries: async () => [...data.entries()],
      save: async () => undefined,
    }
  },
}))

let emits = 0

mock.module("@tauri-apps/api/event", () => ({
  emit: async () => {
    emits++
  },
  listen: async () => () => undefined,
}))

const { defaultDevice } = await import("../settings")
const { advanceCursors, applyRemote, cursorGroups, pendingOutbox, todos } =
  await import("./store")

const settings = file("settings.json")

const useDevice = (todosEnabled = true) =>
  settings.set("device", {
    ...defaultDevice,
    deviceId: "dev-a",
    sync: {
      ...defaultDevice.sync,
      collections: { ...defaultDevice.sync.collections, todos: todosEnabled },
    },
  })

const todo = (over: Partial<Todo> = {}): Todo => ({
  id: "t",
  title: "t",
  notes: "",
  done: false,
  doneAt: null,
  priority: 0,
  due: null,
  tags: [],
  order: 0,
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

const remote = (over: Partial<StoredRecord>): StoredRecord => ({
  collection: "todos",
  id: "m1",
  updatedAt: 100,
  deleted: false,
  deviceId: "dev-m",
  data: todo({ id: "m1", title: "from m" }),
  seq: 1,
  ...over,
})

useDevice()

afterAll(() => setSystemTime())

test("put stamps past the stored record when the clock steps back", async () => {
  setSystemTime(new Date(1000))

  const first = await todos.put(todo())

  setSystemTime(new Date(500))

  const second = await todos.put({ ...first, title: "edited" })
  const [queued] = await pendingOutbox()

  expect(first.updatedAt).toBe(1000)
  expect(second.updatedAt).toBe(1001)
  expect(queued).toMatchObject({ updatedAt: 1001, deviceId: "dev-a" })
})

test("ties resolve against the record's origin, not this device", async () => {
  await applyRemote([remote({})])
  await applyRemote([
    remote({ deviceId: "dev-c", data: todo({ id: "m1", title: "from c" }) }),
  ])

  expect((await todos.get("m1"))?.title).toBe("from c")
})

test("pending outbox skips disabled collections", async () => {
  useDevice(false)

  expect(await pendingOutbox()).toHaveLength(0)

  useDevice(true)

  expect(await pendingOutbox()).toHaveLength(1)
})

test("a collection with no cursor is pulled apart from the rest", async () => {
  await advanceCursors(["todos"], 7)

  expect(await cursorGroups(["todos"])).toEqual([
    { since: 7, names: ["todos"] },
  ])
  expect(await cursorGroups(["todos", "events"])).toEqual([
    { since: 7, names: ["todos"] },
    { since: 0, names: ["events"] },
  ])
})

test("putMany stores and queues every item on one broadcast", async () => {
  const before = emits

  await todos.putMany([todo({ id: "b1" }), todo({ id: "b2" })])

  const queued = (await pendingOutbox()).map(record => record.id)

  expect(emits - before).toBe(1)
  expect((await todos.get("b1"))?.title).toBe("t")
  expect(queued).toContain("b1")
  expect(queued).toContain("b2")
})
