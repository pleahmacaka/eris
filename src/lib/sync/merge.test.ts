import { describe, expect, test } from "bun:test"
import { outboxKey, remoteWins, toLocal } from "./merge"
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

  test("profile keeps only the stamp", () => {
    expect(
      toLocal(
        record({
          collection: "profile",
          id: "profile",
          data: { presetId: "aurora" },
        }),
      ),
    ).toEqual({ id: "profile", updatedAt: 100, deviceId: "dev-b" })
  })

  test("outbox key joins collection and id", () => {
    expect(outboxKey(record())).toBe("todos:a")
  })
})
