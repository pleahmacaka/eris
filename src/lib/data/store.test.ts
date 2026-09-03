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

mock.module("../platform/storage", () => ({
  openStore: async (file: string) => fakeStore(file),
}))

mock.module("../platform/events", () => ({
  publish: async () => {},
  subscribe: async () => () => {},
}))

const { applyRemote, newId, notes, pendingOutbox, clearOutbox } = await import(
  "./store"
)
const { blankNote } = await import("./notes")
const { saveDevice, defaultDevice } = await import("../settings")

beforeEach(async () => {
  for (const data of files.values()) {
    data.clear()
  }

  await saveDevice({ ...defaultDevice, deviceId: "here", deviceName: "here" })
})

const drainOutbox = async () => {
  const records = await pendingOutbox()

  await clearOutbox(records.map(r => `${r.collection}:${r.id}`))

  return records
}

test("a put lands in the collection and in the outbox", async () => {
  const note = { ...blankNote(), id: newId(), title: "첫 메모" }

  await notes.put(note)

  expect((await notes.all()).map(n => n.title)).toEqual(["첫 메모"])

  const [record] = await pendingOutbox()

  expect(record.collection).toBe("notes")
  expect(record.deleted).toBe(false)
})

test("a removed note is hidden but kept as a tombstone", async () => {
  const note = { ...blankNote(), id: newId() }

  await notes.put(note)
  await notes.remove(note.id)

  expect(await notes.all()).toEqual([])
  expect(await notes.get(note.id)).toBeUndefined()

  const record = (await pendingOutbox()).find(r => r.id === note.id)

  expect(record?.deleted).toBe(true)
})

test("a peer that missed the delete cannot resurrect the note", async () => {
  const note = { ...blankNote(), id: newId(), title: "삭제됨" }

  const stored = await notes.put(note)

  await notes.remove(note.id)
  await drainOutbox()

  await applyRemote([
    {
      seq: 9,
      collection: "notes",
      id: note.id,
      updatedAt: stored.updatedAt,
      deleted: false,
      deviceId: "stale-peer",
      data: stored,
    },
  ])

  expect(await notes.all()).toEqual([])
})

test("a newer remote edit wins and is relayed to the other peers", async () => {
  const note = { ...blankNote(), id: newId(), title: "로컬" }

  const stored = await notes.put(note)

  await drainOutbox()

  await applyRemote([
    {
      seq: 4,
      collection: "notes",
      id: note.id,
      updatedAt: stored.updatedAt + 1000,
      deleted: false,
      deviceId: "peer-b",
      data: { ...stored, title: "원격" },
    },
  ])

  expect((await notes.all()).map(n => n.title)).toEqual(["원격"])

  const relayed = await pendingOutbox()

  expect(relayed).toHaveLength(1)
  expect(relayed[0].deviceId).toBe("peer-b")
})

test("an older remote edit is ignored and not relayed", async () => {
  const note = { ...blankNote(), id: newId(), title: "로컬" }

  const stored = await notes.put(note)

  await drainOutbox()

  await applyRemote([
    {
      seq: 4,
      collection: "notes",
      id: note.id,
      updatedAt: stored.updatedAt - 1000,
      deleted: false,
      deviceId: "peer-b",
      data: { ...stored, title: "오래된 값" },
    },
  ])

  expect((await notes.all()).map(n => n.title)).toEqual(["로컬"])
  expect(await pendingOutbox()).toEqual([])
})
