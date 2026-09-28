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

const { applyRemote, localRecords, newId, notes } = await import("./store")
const { blankNote } = await import("./notes")
const { saveDevice, defaultDevice } = await import("../settings")
const { TOMBSTONE_TTL } = await import("../sync/protocol")

beforeEach(async () => {
  for (const data of files.values()) {
    data.clear()
  }

  await saveDevice({ ...defaultDevice, deviceId: "here", deviceName: "here" })
})

test("a put lands in the collection and in the snapshot", async () => {
  const note = { ...blankNote(), id: newId(), title: "첫 메모" }

  await notes.put(note)

  expect((await notes.all()).map(n => n.title)).toEqual(["첫 메모"])

  const [record] = await localRecords(["notes"])

  expect(record.deleted).toBe(false)
  expect(record.deviceId).toBe("here")
})

test("a removed note is hidden but published as a tombstone", async () => {
  const note = { ...blankNote(), id: newId() }

  await notes.put(note)
  await notes.remove(note.id)

  expect(await notes.all()).toEqual([])
  expect(await notes.get(note.id)).toBeUndefined()

  const [record] = await localRecords(["notes"])

  expect(record).toMatchObject({ id: note.id, deleted: true, data: null })
})

test("an expired tombstone is dropped from the store", async () => {
  const note = { ...blankNote(), id: newId() }

  await notes.put(note)
  await notes.remove(note.id)

  expect(await localRecords(["notes"], Date.now() + TOMBSTONE_TTL * 2)).toEqual(
    [],
  )
  expect(await localRecords(["notes"])).toEqual([])
})

test("a peer that missed the delete cannot resurrect the note", async () => {
  const note = { ...blankNote(), id: newId(), title: "삭제됨" }

  const stored = await notes.put(note)

  await notes.remove(note.id)

  await applyRemote([
    {
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

test("a newer remote edit wins", async () => {
  const note = { ...blankNote(), id: newId(), title: "로컬" }

  const stored = await notes.put(note)

  const changed = await applyRemote([
    {
      collection: "notes",
      id: note.id,
      updatedAt: stored.updatedAt + 1000,
      deleted: false,
      deviceId: "peer-b",
      data: { ...stored, title: "원격" },
    },
  ])

  expect(changed).toEqual(["notes"])
  expect((await notes.all()).map(n => n.title)).toEqual(["원격"])
  expect((await localRecords(["notes"]))[0].deviceId).toBe("peer-b")
})

test("an older remote edit is ignored", async () => {
  const note = { ...blankNote(), id: newId(), title: "로컬" }

  const stored = await notes.put(note)

  const changed = await applyRemote([
    {
      collection: "notes",
      id: note.id,
      updatedAt: stored.updatedAt - 1000,
      deleted: false,
      deviceId: "peer-b",
      data: { ...stored, title: "오래된 값" },
    },
  ])

  expect(changed).toEqual([])
  expect((await notes.all()).map(n => n.title)).toEqual(["로컬"])
})

test("a remote delete of an unseen note still leaves a tombstone", async () => {
  await applyRemote([
    {
      collection: "notes",
      id: "ghost",
      updatedAt: Date.now(),
      deleted: true,
      deviceId: "peer-b",
      data: null,
    },
  ])

  expect(await localRecords(["notes"])).toMatchObject([
    { id: "ghost", deleted: true },
  ])
})
