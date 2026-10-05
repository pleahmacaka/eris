import { describe, expect, test } from "bun:test"
import { readSnapshot, remoteWins, toLocal } from "../../../src/lib/sync/merge"
import type { SyncRecord } from "../../../src/lib/sync/protocol"

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
  const file = { content: "# 제목", base: null }

  const payload = (records: unknown[], app?: string) =>
    JSON.stringify({ deviceId: "dev-b", app, records })

  test("keeps valid records and drops the rest", () => {
    const { records } = readSnapshot(
      payload(
        [
          record({ collection: "files", id: "a/노트.md", data: file }),
          record({ collection: "files", id: "bad.md", data: { content: 1 } }),
          record({ collection: "files", id: "../p2p.json", data: file }),
          record({ collection: "files", id: "a/../b.md", data: file }),
          record({ collection: "files", id: ".obsidian/x.md", data: file }),
          record({ collection: "profile" as never, id: "profile", data: {} }),
          record({ id: "gone", deleted: true, data: { leaked: true } }),
        ],
        "note",
      ),
      1_000,
    )

    expect(records.map(r => r.id)).toEqual(["a/노트.md", "gone"])
    expect(records[1].data).toBeNull()
  })

  test("accepts only events from a snapshot that is not from note", () => {
    const event = record({ collection: "events", id: "e", deleted: true })

    for (const app of ["eris", undefined]) {
      const { records } = readSnapshot(
        payload(
          [record({ collection: "files", id: "a.md", data: file }), event],
          app,
        ),
        1_000,
      )

      expect(records.map(r => r.id)).toEqual(["e"])
    }
  })

  test("drops records stamped far in the future", () => {
    const future = record({ updatedAt: 10 ** 12, deleted: true, data: null })

    expect(readSnapshot(payload([future], "note"), 0).records).toEqual([])
  })

  test("returns nothing for malformed input", () => {
    expect(readSnapshot("not json").records).toEqual([])
    expect(readSnapshot(JSON.stringify({ records: 1 })).records).toEqual([])
  })
})
