import { beforeEach, expect, mock, test } from "bun:test"

const files = new Map<string, Map<string, unknown>>()

const fakeStore = (file: string) => {
  const data = files.get(file) ?? new Map<string, unknown>()

  files.set(file, data)

  return {
    get: async (key: string) => data.get(key),
    set: async (key: string, value: unknown) => {
      data.set(key, value)
    },
    delete: async (key: string) => data.delete(key),
    keys: async () => [...data.keys()],
    entries: async () => [...data.entries()],
    save: async () => {},
    onKeyChange: async () => () => {},
  }
}

mock.module("../../../src/lib/platform/storage", () => ({
  openStore: async (file: string) => fakeStore(file),
}))

mock.module("../../../src/lib/platform/events", () => ({
  publish: async () => {},
  subscribe: async () => () => {},
}))

const { applyRemote, localRecords, newId, todos } = await import(
  "../../../src/lib/data/store"
)

const blankTodo = () => ({
  id: newId(),
  title: "",
  notes: "",
  done: false,
  doneAt: null,
  priority: 0 as const,
  due: null,
  tags: [],
  order: 0,
  createdAt: 1,
  updatedAt: 1,
})
const { saveDevice, defaultDevice } = await import("../../../src/lib/settings")
const { TOMBSTONE_TTL } = await import("../../../src/lib/sync/protocol")

beforeEach(async () => {
  for (const data of files.values()) {
    data.clear()
  }

  await saveDevice({ ...defaultDevice, deviceId: "here", deviceName: "here" })
})

test("a put lands in the collection and in the snapshot", async () => {
  const todo = { ...blankTodo(), id: newId(), title: "첫 메모" }

  await todos.put(todo)

  expect((await todos.all()).map(n => n.title)).toEqual(["첫 메모"])

  const [record] = await localRecords(["todos"])

  expect(record.deleted).toBe(false)
  expect(record.deviceId).toBe("here")
})

test("a removed todo is hidden but published as a tombstone", async () => {
  const todo = { ...blankTodo(), id: newId() }

  await todos.put(todo)
  await todos.remove(todo.id)

  expect(await todos.all()).toEqual([])
  expect(await todos.get(todo.id)).toBeUndefined()

  const [record] = await localRecords(["todos"])

  expect(record).toMatchObject({ id: todo.id, deleted: true, data: null })
})

test("an expired tombstone is dropped from the store", async () => {
  const todo = { ...blankTodo(), id: newId() }

  await todos.put(todo)
  await todos.remove(todo.id)

  expect(await localRecords(["todos"], Date.now() + TOMBSTONE_TTL * 2)).toEqual(
    [],
  )
  expect(await localRecords(["todos"])).toEqual([])
})

test("a peer that missed the delete cannot resurrect the todo", async () => {
  const todo = { ...blankTodo(), id: newId(), title: "삭제됨" }

  const stored = await todos.put(todo)

  await todos.remove(todo.id)

  await applyRemote([
    {
      collection: "todos",
      id: todo.id,
      updatedAt: stored.updatedAt,
      deleted: false,
      deviceId: "stale-peer",
      data: stored,
    },
  ])

  expect(await todos.all()).toEqual([])
})

test("a newer remote edit wins", async () => {
  const todo = { ...blankTodo(), id: newId(), title: "로컬" }

  const stored = await todos.put(todo)

  const changed = await applyRemote([
    {
      collection: "todos",
      id: todo.id,
      updatedAt: stored.updatedAt + 1000,
      deleted: false,
      deviceId: "peer-b",
      data: { ...stored, title: "원격" },
    },
  ])

  expect(changed).toEqual(["todos"])
  expect((await todos.all()).map(n => n.title)).toEqual(["원격"])
  expect((await localRecords(["todos"]))[0].deviceId).toBe("peer-b")
})

test("an older remote edit is ignored", async () => {
  const todo = { ...blankTodo(), id: newId(), title: "로컬" }

  const stored = await todos.put(todo)

  const changed = await applyRemote([
    {
      collection: "todos",
      id: todo.id,
      updatedAt: stored.updatedAt - 1000,
      deleted: false,
      deviceId: "peer-b",
      data: { ...stored, title: "오래된 값" },
    },
  ])

  expect(changed).toEqual([])
  expect((await todos.all()).map(n => n.title)).toEqual(["로컬"])
})

test("a remote delete of an unseen todo still leaves a tombstone", async () => {
  await applyRemote([
    {
      collection: "todos",
      id: "ghost",
      updatedAt: Date.now(),
      deleted: true,
      deviceId: "peer-b",
      data: null,
    },
  ])

  expect(await localRecords(["todos"])).toMatchObject([
    { id: "ghost", deleted: true },
  ])
})
