import { afterAll, expect, mock, setSystemTime, test } from "bun:test"
import type { Todo } from "@eris/data"
import { type SyncRecord, TOMBSTONE_TTL } from "@eris/sync/protocol"

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

const { defaultDevice } = await import("@eris/settings")
const { applyRemote, localRecords, todos } = await import("./store")

const settings = file("settings.json")

settings.set("device", { ...defaultDevice, deviceId: "dev-a" })

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

const remote = (over: Partial<SyncRecord>): SyncRecord => ({
  collection: "todos",
  id: "m1",
  updatedAt: 100,
  deleted: false,
  deviceId: "dev-m",
  data: todo({ id: "m1", title: "from m" }),
  ...over,
})

const recordOf = async (id: string, now?: number) =>
  (await localRecords(["todos"], now)).find(r => r.id === id)

afterAll(() => setSystemTime())

test("put stamps past the stored record when the clock steps back", async () => {
  setSystemTime(new Date(1000))

  const first = await todos.put(todo())

  setSystemTime(new Date(500))

  const second = await todos.put({ ...first, title: "edited" })

  expect(first.updatedAt).toBe(1000)
  expect(second.updatedAt).toBe(1001)
  expect(await recordOf("t")).toMatchObject({
    updatedAt: 1001,
    deviceId: "dev-a",
    deleted: false,
  })
})

test("ties resolve against the record's origin, not this device", async () => {
  await applyRemote([remote({})])
  await applyRemote([
    remote({ deviceId: "dev-c", data: todo({ id: "m1", title: "from c" }) }),
  ])

  expect((await todos.get("m1"))?.title).toBe("from c")
})

test("putMany stores every item on one broadcast", async () => {
  const before = emits

  await todos.putMany([todo({ id: "b1" }), todo({ id: "b2" })])

  expect(emits - before).toBe(1)
  expect((await todos.get("b1"))?.title).toBe("t")
  expect(await recordOf("b1")).toBeDefined()
  expect(await recordOf("b2")).toBeDefined()
})

test("an older remote put does not resurrect a local delete", async () => {
  setSystemTime(new Date(2000))
  await todos.put(todo({ id: "d1" }))

  setSystemTime(new Date(3000))
  await todos.remove("d1")
  await applyRemote([remote({ id: "d1", updatedAt: 2500 })])

  expect(await todos.get("d1")).toBeUndefined()
  expect(await recordOf("d1")).toMatchObject({ updatedAt: 3000, deleted: true })
})

test("a put after a delete out-stamps and clears the tombstone", async () => {
  setSystemTime(new Date(2500))

  const back = await todos.put(todo({ id: "d1" }))

  expect(back.updatedAt).toBe(3001)
  expect(await recordOf("d1")).toMatchObject({ deleted: false })
})

test("a remote delete is kept until it expires", async () => {
  await applyRemote([
    remote({ id: "gone", updatedAt: 4000, deleted: true, data: null }),
  ])

  expect(await recordOf("gone", 4000)).toMatchObject({ deleted: true })
  expect(await recordOf("gone", 4001 + TOMBSTONE_TTL)).toBeUndefined()
})
