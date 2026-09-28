import { describe, expect, test } from "bun:test"
import { readSnapshot, remoteWins, toLocal } from "./merge"
import type { SyncRecord } from "./protocol"

const record = (over: Partial<SyncRecord> = {}): SyncRecord => ({
  collection: "todos",
  id: "a",
  updatedAt: 100,
  deleted: false,
  deviceId: "dev-b",
  data: { title: "x" },
  ...over,
})

describe("remoteWins", () => {
  test("wins when nothing local", () => {
    expect(remoteWins(record(), undefined, "dev-a")).toBe(true)
  })

  test("wins when newer", () => {
    expect(remoteWins(record(), { updatedAt: 99 }, "dev-a")).toBe(true)
  })

  test("loses when older", () => {
    expect(remoteWins(record(), { updatedAt: 101 }, "dev-a")).toBe(false)
  })

  test("tie goes to the lower device id", () => {
    expect(remoteWins(record(), { updatedAt: 100 }, "dev-c")).toBe(true)
    expect(remoteWins(record(), { updatedAt: 100 }, "dev-a")).toBe(false)
    expect(remoteWins(record(), { updatedAt: 100 }, "dev-b")).toBe(false)
  })

  test("tie uses the local record origin over our own id", () => {
    const pulledFromM = { updatedAt: 100, deviceId: "dev-m" }

    expect(remoteWins(record(), pulledFromM, "dev-a")).toBe(true)
    expect(
      remoteWins(record({ deviceId: "dev-z" }), pulledFromM, "dev-a"),
    ).toBe(false)
  })
})

describe("toLocal", () => {
  test("stamps id and updatedAt over data", () => {
    expect(toLocal(record({ data: { id: "stale", title: "x" } }))).toEqual({
      id: "a",
      title: "x",
      updatedAt: 100,
      deviceId: "dev-b",
    })
  })
})

describe("readSnapshot", () => {
  const note = {
    id: "n",
    title: "t",
    body: "b",
    pinned: false,
    color: null,
    createdAt: 1,
    updatedAt: 100,
  }

  const payload = (records: unknown[]) =>
    JSON.stringify({ deviceId: "dev-b", records })

  test("keeps valid records and drops the rest", () => {
    const kept = readSnapshot(
      payload([
        record({ collection: "notes", id: "n", data: note }),
        record({ collection: "notes", id: "bad", data: { title: 1 } }),
        record({ collection: "profile" as never, id: "profile", data: {} }),
        record({ id: "gone", deleted: true, data: { leaked: true } }),
      ]),
      1_000,
    )

    expect(kept.map(r => r.id)).toEqual(["n", "gone"])
    expect(kept[1].data).toBeNull()
  })

  test("drops records stamped far in the future", () => {
    const future = record({ updatedAt: 10 ** 12, deleted: true, data: null })

    expect(readSnapshot(payload([future]), 0)).toEqual([])
  })

  test("returns nothing for malformed input", () => {
    expect(readSnapshot("not json")).toEqual([])
    expect(readSnapshot(JSON.stringify({ records: 1 }))).toEqual([])
  })
})
