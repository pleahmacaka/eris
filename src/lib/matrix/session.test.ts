import { describe, expect, test } from "bun:test"
import {
  clearSession,
  DEFAULT_HOMESERVER,
  isUserId,
  loadSession,
  normalizeHomeserver,
  parseSession,
  parseUserIds,
  SESSION_KEY,
  saveSession,
  splitUserId,
} from "./session"

const memoryStorage = () => {
  const map = new Map<string, string>()

  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    removeItem: (key: string) => {
      map.delete(key)
    },
  }
}

const session = {
  homeserver: "https://example.org",
  userId: "@alice:example.org",
  accessToken: "token",
  deviceId: "DEVICE",
}

describe("normalizeHomeserver", () => {
  test("adds https and strips trailing slashes", () => {
    expect(normalizeHomeserver(" example.org:8448// ")).toBe(
      "https://example.org:8448",
    )
  })

  test("keeps an explicit scheme", () => {
    expect(normalizeHomeserver("http://localhost:8008/")).toBe(
      "http://localhost:8008",
    )
  })

  test("returns empty for blank input", () => {
    expect(normalizeHomeserver("   ")).toBe("")
  })
})

describe("isUserId", () => {
  test("accepts @local:server", () => {
    expect(isUserId("@eris-bob:example.org")).toBe(true)
  })

  test("rejects names without sigil or server", () => {
    expect(isUserId("eris-bob")).toBe(false)
    expect(isUserId("@eris-bob")).toBe(false)
    expect(isUserId("@:server")).toBe(false)
    expect(isUserId("@bob:")).toBe(false)
  })
})

describe("parseUserIds", () => {
  test("splits on commas and spaces and drops duplicates", () => {
    expect(parseUserIds(" @a:x.org, @b:x.org  @a:x.org ")).toEqual([
      "@a:x.org",
      "@b:x.org",
    ])
  })

  test("rejects blank input or any malformed ID", () => {
    expect(parseUserIds("  ")).toBeNull()
    expect(parseUserIds("@a:x.org, bob")).toBeNull()
  })
})

describe("parseSession", () => {
  test("round-trips through storage", () => {
    const storage = memoryStorage()

    saveSession(storage, session)

    expect(storage.getItem(SESSION_KEY)).not.toBeNull()
    expect(loadSession(storage)).toEqual(session)

    clearSession(storage)

    expect(loadSession(storage)).toBeNull()
  })

  test("rejects malformed or incomplete payloads", () => {
    expect(parseSession(null)).toBeNull()
    expect(parseSession("not json")).toBeNull()
    expect(
      parseSession(JSON.stringify({ ...session, accessToken: "" })),
    ).toBeNull()
    expect(parseSession(JSON.stringify({ userId: 1 }))).toBeNull()
  })

  test("normalizes the stored homeserver", () => {
    const parsed = parseSession(
      JSON.stringify({ ...session, homeserver: "example.org/" }),
    )

    expect(parsed?.homeserver).toBe("https://example.org")
  })
})

describe("defaults", () => {
  test("defaults to matrix.org", () => {
    expect(DEFAULT_HOMESERVER).toBe("matrix.org")
    expect(normalizeHomeserver(DEFAULT_HOMESERVER)).toBe("https://matrix.org")
  })
})

describe("splitUserId", () => {
  test("splits a full Matrix ID", () => {
    expect(splitUserId(" @alice:example.org ")).toEqual({
      localpart: "alice",
      domain: "example.org",
    })
  })

  test("keeps a bare localpart without a domain", () => {
    expect(splitUserId("alice")).toEqual({ localpart: "alice", domain: null })
    expect(splitUserId("@alice")).toEqual({ localpart: "alice", domain: null })
    expect(splitUserId("@alice:")).toEqual({ localpart: "alice", domain: null })
  })

  test("keeps a port in the domain", () => {
    expect(splitUserId("@bob:example.org:8448")).toEqual({
      localpart: "bob",
      domain: "example.org:8448",
    })
  })
})
