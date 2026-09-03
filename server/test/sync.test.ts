import { beforeEach, describe, expect, test } from "bun:test"
import type {
  DeviceInfo,
  HealthResponse,
  PullResponse,
  PushResponse,
  ResetResponse,
  SyncRecord,
} from "../../src/lib/sync/protocol.ts"
import { type App, createApp } from "../src/app.ts"
import { openDb } from "../src/db.ts"

const token = "test-token"

let app: App

beforeEach(() => {
  app = createApp({ db: openDb(":memory:"), token })
})

type Call = { method?: string; body?: unknown; auth?: string | null }

const call = (path: string, { method, body, auth }: Call = {}) =>
  app.request(path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "content-type": "application/json",
      ...(auth === null ? {} : { authorization: `Bearer ${auth ?? token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

const push = async (deviceId: string, recs: Partial<SyncRecord>[]) => {
  const records = recs.map(r => ({
    collection: "todos",
    updatedAt: 1,
    deleted: false,
    deviceId,
    data: { title: r.id },
    ...r,
  }))
  const res = await call("/sync/push", {
    body: { deviceId, deviceName: deviceId, records },
  })

  expect(res.status).toBe(200)

  return (await res.json()) as PushResponse
}

const pull = async (since = 0, limit?: number) => {
  const query = limit ? `&limit=${limit}` : ""
  const res = await call(`/sync/pull?since=${since}${query}`)

  expect(res.status).toBe(200)

  return (await res.json()) as PullResponse
}

describe("auth", () => {
  test("health is open", async () => {
    const res = await call("/health", { auth: null })
    const json = (await res.json()) as HealthResponse

    expect(res.status).toBe(200)
    expect(json).toMatchObject({ ok: true, seq: 0 })
    expect(typeof json.version).toBe("string")
  })

  test("401 without token", async () => {
    expect((await call("/devices", { auth: null })).status).toBe(401)
    expect((await call("/sync/pull", { auth: null })).status).toBe(401)
    expect(
      (await call("/collections/todos", { method: "DELETE", auth: null }))
        .status,
    ).toBe(401)
    expect((await call("/sync/push", { body: {}, auth: null })).status).toBe(
      401,
    )
  })

  test("401 with wrong token", async () => {
    expect((await call("/devices", { auth: "nope" })).status).toBe(401)
    expect((await call("/devices", { auth: "test-token-x" })).status).toBe(401)
  })

  test("401 when char length matches but byte length differs", async () => {
    expect((await call("/devices", { auth: "test-tokeé" })).status).toBe(401)
  })
})

describe("push and pull", () => {
  test("round trip", async () => {
    const pushed = await push("d1", [{ id: "a", data: { title: "milk" } }])

    expect(pushed).toEqual({ seq: 1, applied: 1, stale: [] })

    const pulled = await pull()

    expect(pulled.seq).toBe(1)
    expect(pulled.hasMore).toBe(false)
    expect(pulled.records).toEqual([
      {
        collection: "todos",
        id: "a",
        seq: 1,
        updatedAt: 1,
        deleted: false,
        deviceId: "d1",
        data: { title: "milk" },
      },
    ])
  })

  test("LWW rejects older updatedAt", async () => {
    await push("d1", [{ id: "a", updatedAt: 10, data: { v: "new" } }])
    const older = await push("d2", [{ id: "a", updatedAt: 5, data: { v: 0 } }])

    expect(older).toEqual({ seq: 1, applied: 0, stale: ["a"] })

    const pulled = await pull()

    expect(pulled.records).toHaveLength(1)
    expect(pulled.records[0]?.data).toEqual({ v: "new" })
    expect(pulled.records[0]?.deviceId).toBe("d1")
  })

  test("tie breaks by lower deviceId", async () => {
    await push("b-device", [{ id: "a", updatedAt: 10 }])
    const lower = await push("a-device", [{ id: "a", updatedAt: 10 }])
    const higher = await push("c-device", [{ id: "a", updatedAt: 10 }])
    const same = await push("a-device", [{ id: "a", updatedAt: 10 }])

    expect(lower.applied).toBe(1)
    expect(higher.stale).toEqual(["a"])
    expect(same.stale).toEqual(["a"])

    const pulled = await pull()

    expect(pulled.records).toHaveLength(1)
    expect(pulled.records[0]?.deviceId).toBe("a-device")
    expect(pulled.records[0]?.seq).toBe(2)
  })

  test("tombstone propagates", async () => {
    await push("d1", [{ id: "a", updatedAt: 1 }])
    const deleted = await push("d2", [
      { id: "a", updatedAt: 2, deleted: true, data: null },
    ])

    expect(deleted.applied).toBe(1)

    const pulled = await pull(1)

    expect(pulled.records).toHaveLength(1)
    expect(pulled.records[0]).toMatchObject({
      id: "a",
      seq: 2,
      deleted: true,
      deviceId: "d2",
    })
  })

  test("pagination with hasMore and since cursor", async () => {
    await push(
      "d1",
      ["a", "b", "c", "d", "e"].map(id => ({ id })),
    )

    const first = await pull(0, 2)

    expect(first.hasMore).toBe(true)
    expect(first.records.map(r => r.seq)).toEqual([1, 2])

    const second = await pull(2, 2)

    expect(second.hasMore).toBe(true)
    expect(second.records.map(r => r.seq)).toEqual([3, 4])

    const third = await pull(4, 2)

    expect(third.hasMore).toBe(false)
    expect(third.records.map(r => r.seq)).toEqual([5])
    expect(third.seq).toBe(5)
  })

  test("pull returns only the collections asked for", async () => {
    await push("d1", [{ id: "a" }, { collection: "notes", id: "n1" }])

    const res = await call("/sync/pull?since=0&collections=notes")
    const filtered = (await res.json()) as PullResponse

    expect(filtered.records.map(r => r.id)).toEqual(["n1"])
    expect((await pull()).records).toHaveLength(2)
  })

  test("pull touches device lastSeen", async () => {
    await call("/sync/register", {
      body: { deviceId: "d1", deviceName: "one" },
    })
    const before = ((await (await call("/devices")).json()) as DeviceInfo[])[0]

    await new Promise(r => setTimeout(r, 5))
    await call("/sync/pull?since=0&device=d1")

    const after = ((await (await call("/devices")).json()) as DeviceInfo[])[0]

    expect(after?.lastSeen).toBeGreaterThan(before?.lastSeen ?? 0)
  })
})

describe("validation", () => {
  test("unknown collection is 400", async () => {
    const reset = await call("/collections/nope", { method: "DELETE" })

    expect(reset.status).toBe(400)
  })

  test("a record the server does not know is skipped, not fatal", async () => {
    const pushed = await push("d1", [
      { id: "a", data: { title: "milk" } },
      { collection: "nope", id: "b" } as unknown as Partial<SyncRecord>,
      { id: "c" },
    ])

    expect(pushed).toMatchObject({ applied: 2, stale: ["b"] })

    const pulled = await pull()

    expect(pulled.records.map(r => r.id)).toEqual(["a", "c"])
  })

  test("bad shapes are 400", async () => {
    const cases: unknown[] = [
      {},
      { deviceId: "d1", deviceName: "d1", records: "x" },
      { deviceId: 1, deviceName: "d1", records: [] },
    ]

    for (const body of cases) {
      expect((await call("/sync/push", { body })).status).toBe(400)
    }

    expect(
      (await call("/sync/register", { body: { deviceId: "" } })).status,
    ).toBe(400)

    const malformed = await app.request("/sync/push", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: "{not json",
    })

    expect(malformed.status).toBe(400)
    expect((await call("/sync/pull?since=abc")).status).toBe(400)
  })
})

describe("collections", () => {
  test("soft reset tombstones every live record and bumps seq", async () => {
    await push("d1", [{ id: "a" }, { id: "b" }, { id: "c" }])
    await push("d1", [{ id: "e1", collection: "events" }])
    await push("d1", [{ id: "c", updatedAt: 2, deleted: true }])

    const before = Date.now()
    const res = await call("/collections/todos", { method: "DELETE" })
    const reset = (await res.json()) as ResetResponse

    expect(res.status).toBe(200)
    expect(reset).toEqual({ seq: 7, tombstoned: 2 })

    const pulled = await pull(5)

    expect(pulled.records.map(r => r.id).sort()).toEqual(["a", "b"])

    for (const r of pulled.records) {
      expect(r.collection).toBe("todos")
      expect(r.deleted).toBe(true)
      expect(r.updatedAt).toBeGreaterThanOrEqual(before)
    }

    const all = await pull(0)
    const event = all.records.find(r => r.collection === "events")

    expect(event).toMatchObject({ id: "e1", deleted: false, seq: 4 })
    expect(all.records).toHaveLength(4)
  })

  test("soft reset tombstone outlives a row stamped ahead of the clock", async () => {
    const ahead = Date.now() + 60_000
    await push("d1", [{ id: "a", updatedAt: ahead }])

    await call("/collections/todos", { method: "DELETE" })

    const tombstone = (await pull(1)).records[0]

    expect(tombstone).toMatchObject({ id: "a", deleted: true })
    expect(tombstone?.updatedAt).toBeGreaterThan(ahead)

    const replay = await push("d1", [{ id: "a", updatedAt: ahead }])

    expect(replay.stale).toEqual(["a"])
  })

  test("purge removes rows", async () => {
    await push("d1", [{ id: "a" }, { id: "b" }])
    await push("d1", [{ id: "e1", collection: "events" }])

    const res = await call("/collections/todos?purge=1", { method: "DELETE" })
    const reset = (await res.json()) as ResetResponse

    expect(reset).toEqual({ seq: 3, tombstoned: 2 })

    const pulled = await pull(0)

    expect(pulled.records.map(r => r.id)).toEqual(["e1"])
    expect(pulled.seq).toBe(3)

    const health = (await (
      await call("/health", { auth: null })
    ).json()) as HealthResponse

    expect(health.seq).toBe(3)
  })
})

describe("devices", () => {
  test("register, list, delete", async () => {
    const res = await call("/sync/register", {
      body: { deviceId: "d1", deviceName: "Desk" },
    })
    const device = (await res.json()) as DeviceInfo

    expect(res.status).toBe(200)
    expect(device).toMatchObject({ id: "d1", name: "Desk" })
    expect(device.createdAt).toBeGreaterThan(0)
    expect(device.lastSeen).toBe(device.createdAt)

    const renamed = (await (
      await call("/sync/register", {
        body: { deviceId: "d1", deviceName: "Laptop" },
      })
    ).json()) as DeviceInfo

    expect(renamed.name).toBe("Laptop")
    expect(renamed.createdAt).toBe(device.createdAt)

    await push("d2", [{ id: "a" }])

    const list = (await (await call("/devices")).json()) as DeviceInfo[]

    expect(list.map(d => d.id)).toEqual(["d1", "d2"])

    const removed = await call("/devices/d1", { method: "DELETE" })

    expect(removed.status).toBe(204)

    const after = (await (await call("/devices")).json()) as DeviceInfo[]

    expect(after.map(d => d.id)).toEqual(["d2"])
  })
})
