import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { FileData, SyncRecord } from "../../../src/lib/sync/protocol"

const stores = new Map<string, Map<string, unknown>>()
const files = new Map<string, string>()
const mtimes = new Map<string, number>()
const vault = { root: "R", entries: [] as { path: string; folder: boolean }[] }

const list = () => {
  vault.entries = [...files.keys()].map(path => ({ path, folder: false }))
}

mock.module("../../../src/lib/platform/storage", () => ({
  openStore: async (file: string) => {
    const data = stores.get(file) ?? new Map<string, unknown>()

    stores.set(file, data)

    return {
      get: async (key: string) => data.get(key),
      set: async (key: string, value: unknown) => {
        data.set(key, value)
      },
      delete: async (key: string) => data.delete(key),
      keys: async () => [...data.keys()],
      entries: async () => [...data.entries()],
      save: async () => {},
    }
  },
}))

mock.module("../../../src/lib/vault/disk", () => ({
  modifiedAt: async (_root: string, path: string) => mtimes.get(path) ?? null,
}))

mock.module("../../../src/lib/vault/vault.svelte", () => ({
  vault,
  readFile: async (path: string) => files.get(path) ?? "",
  writeExternal: async (path: string, text: string) => {
    files.set(path, text)
  },
  removeExternal: async (path: string) => {
    files.delete(path)
  },
  refreshVault: async () => list(),
}))

const { applyVaultRemote, isEcho, vaultRecords } = await import(
  "../../../src/lib/vault/sync"
)
const { MAX_FILE, TOMBSTONE_TTL } = await import(
  "../../../src/lib/sync/protocol"
)

const NOW = Date.now()

const put = (path: string, text: string, mtime = NOW - 1_000) => {
  files.set(path, text)
  mtimes.set(path, mtime)
  list()
}

const remote = (over: Partial<SyncRecord> = {}): SyncRecord => ({
  collection: "files",
  id: "a.md",
  updatedAt: NOW + 5_000,
  deleted: false,
  deviceId: "peer",
  data: { content: "원격", base: null } satisfies FileData,
  ...over,
})

const byId = (records: SyncRecord[], id: string) =>
  records.find(r => r.id === id)

beforeEach(() => {
  for (const data of stores.values()) {
    data.clear()
  }

  files.clear()
  mtimes.clear()
  list()
})

describe("vaultRecords", () => {
  test("stamps a new file with its modified time and this device", async () => {
    put("a.md", "첫 내용", NOW - 60_000)

    const { records } = await vaultRecords("here", NOW)

    expect(byId(records, "a.md")).toMatchObject({
      updatedAt: NOW - 60_000,
      deviceId: "here",
      deleted: false,
      data: { content: "첫 내용", base: null },
    })
  })

  test("never stamps a file in the future", async () => {
    put("a.md", "x", NOW + 10 ** 9)

    const { records } = await vaultRecords("here", NOW)

    expect(byId(records, "a.md")?.updatedAt).toBe(NOW)
  })

  test("keeps the stamp while the content is unchanged", async () => {
    put("a.md", "같음")

    const first = await vaultRecords("here", NOW)
    const second = await vaultRecords("here", NOW + 60_000)

    expect(byId(second.records, "a.md")?.updatedAt).toBe(
      byId(first.records, "a.md")?.updatedAt,
    )
  })

  test("restamps an edit and remembers the version it started from", async () => {
    put("a.md", "처음")

    const first = await vaultRecords("here", NOW)

    put("a.md", "고침", NOW + 30_000)

    const second = await vaultRecords("here", NOW + 60_000)
    const edited = byId(second.records, "a.md")

    expect(edited?.updatedAt).toBeGreaterThan(
      byId(first.records, "a.md")?.updatedAt ?? 0,
    )
    expect(edited).toBeDefined()
    expect((edited?.data as FileData | undefined)?.base).toBeString()
  })

  test("turns a vanished file into a tombstone, then forgets it", async () => {
    put("a.md", "곧 삭제")
    await vaultRecords("here", NOW)
    files.delete("a.md")
    list()

    const { records } = await vaultRecords("here", NOW + 1_000)

    expect(byId(records, "a.md")).toMatchObject({ deleted: true, data: null })

    const later = await vaultRecords("here", NOW + 1_000 + TOMBSTONE_TTL * 2)

    expect(byId(later.records, "a.md")).toBeUndefined()
  })

  test("skips oversized files without deleting them elsewhere", async () => {
    put("big.md", "x".repeat(MAX_FILE + 1))

    const { records, oversized } = await vaultRecords("here", NOW)

    expect(oversized).toEqual(["big.md"])
    expect(byId(records, "big.md")).toBeUndefined()
  })
})

describe("applyVaultRemote", () => {
  test("writes a newer remote version and adopts its stamp", async () => {
    put("a.md", "로컬")
    await vaultRecords("here", NOW)

    const changed = await applyVaultRemote([remote()], "here")

    expect(changed).toEqual(["a.md"])
    expect(files.get("a.md")).toBe("원격")
    expect(isEcho("a.md")).toBe(true)

    const { records } = await vaultRecords("here", NOW + 10_000)

    expect(byId(records, "a.md")).toMatchObject({
      updatedAt: NOW + 5_000,
      deviceId: "peer",
    })
  })

  test("ignores an older remote version", async () => {
    put("a.md", "로컬", NOW)
    await vaultRecords("here", NOW)

    const changed = await applyVaultRemote(
      [remote({ updatedAt: NOW - 60_000 })],
      "here",
    )

    expect(changed).toEqual([])
    expect(files.get("a.md")).toBe("로컬")
  })

  test("applies a newer remote delete", async () => {
    put("a.md", "로컬")
    await vaultRecords("here", NOW)

    await applyVaultRemote([remote({ deleted: true, data: null })], "here")

    expect(files.has("a.md")).toBe(false)
  })

  test("creates a file this device has never seen", async () => {
    await applyVaultRemote([remote({ id: "새/노트.md" })], "here")

    expect(files.get("새/노트.md")).toBe("원격")
  })

  test("refuses a remote path that differs from a local one only by case", async () => {
    put("Note.md", "로컬")

    const changed = await applyVaultRemote([remote({ id: "note.md" })], "here")

    expect(changed).toEqual([])
    expect(files.has("note.md")).toBe(false)
  })
})
