import { describe, expect, test } from "bun:test"
import {
  type ChannelLike,
  channelKind,
  orphanRooms,
  parseRoomAddress,
  sortChannels,
  spaceBadge,
  splitChannels,
} from "./spaces"

const channel = (overrides: Partial<ChannelLike>): ChannelLike => ({
  id: "!a:example.org",
  name: "general",
  kind: "text",
  membership: "join",
  unread: 0,
  highlight: 0,
  order: undefined,
  childTs: 0,
  ...overrides,
})

describe("channelKind", () => {
  test("marks Element Call rooms as voice channels", () => {
    expect(channelKind("org.matrix.msc3417.call")).toBe("voice")
    expect(channelKind(undefined)).toBe("text")
    expect(channelKind("m.space")).toBe("text")
  })
})

describe("channel ordering", () => {
  test("sorts by the space child order, then child timestamp, then name", () => {
    const sorted = sortChannels([
      channel({ id: "!c", name: "c", childTs: 30 }),
      channel({ id: "!b", name: "b", order: "b" }),
      channel({ id: "!a", name: "a", order: "a" }),
      channel({ id: "!d", name: "d", childTs: 10 }),
      channel({ id: "!e", name: "가", childTs: 10 }),
    ])

    expect(sorted.map(c => c.id)).toEqual(["!a", "!b", "!e", "!d", "!c"])
  })

  test("splits text and voice channels", () => {
    const { text, voice } = splitChannels([
      channel({ id: "!t", kind: "text" }),
      channel({ id: "!v", kind: "voice" }),
    ])

    expect(text.map(c => c.id)).toEqual(["!t"])
    expect(voice.map(c => c.id)).toEqual(["!v"])
  })
})

describe("space badge", () => {
  test("sums unread and highlights of joined channels only", () => {
    expect(
      spaceBadge([
        channel({ unread: 2, highlight: 1 }),
        channel({ unread: 3, highlight: 0 }),
        channel({ unread: 9, highlight: 9, membership: "invite" }),
      ]),
    ).toEqual({ unread: 5, highlight: 1 })
  })
})

describe("orphanRooms", () => {
  test("keeps rooms that belong to no space", () => {
    const rooms = [{ id: "!in" }, { id: "!out" }]

    expect(orphanRooms(rooms, new Set(["!in"]))).toEqual([{ id: "!out" }])
  })
})

describe("parseRoomAddress", () => {
  test("accepts aliases and room ids with their server as via", () => {
    expect(parseRoomAddress(" #eris:example.org ")).toEqual({
      target: "#eris:example.org",
      via: ["example.org"],
    })
    expect(parseRoomAddress("!abc:example.org")).toEqual({
      target: "!abc:example.org",
      via: ["example.org"],
    })
  })

  test("unwraps matrix.to and matrix: links", () => {
    expect(
      parseRoomAddress(
        "https://matrix.to/#/%23eris%3Aexample.org?via=example.org",
      ),
    ).toEqual({ target: "#eris:example.org", via: ["example.org"] })
    expect(parseRoomAddress("matrix:r/eris:example.org")).toEqual({
      target: "#eris:example.org",
      via: ["example.org"],
    })
  })

  test("reads via servers from a link and keeps room ids without a server", () => {
    expect(
      parseRoomAddress("https://matrix.to/#/!v12RoomId?via=a.org&via=b.org"),
    ).toEqual({ target: "!v12RoomId", via: ["a.org", "b.org"] })
    expect(parseRoomAddress("matrix:roomid/v12RoomId?via=a.org")).toEqual({
      target: "!v12RoomId",
      via: ["a.org"],
    })
    expect(parseRoomAddress("!v12RoomId")).toEqual({
      target: "!v12RoomId",
      via: [],
    })
  })

  test("resolves an event link to its room", () => {
    expect(
      parseRoomAddress(
        "https://matrix.to/#/!abc%3Aexample.org/%24event?via=example.org",
      ),
    ).toEqual({ target: "!abc:example.org", via: ["example.org"] })
  })

  test("rejects addresses without a sigil or server", () => {
    expect(parseRoomAddress("eris")).toBeNull()
    expect(parseRoomAddress("#eris")).toBeNull()
    expect(parseRoomAddress("!abc:")).toBeNull()
    expect(parseRoomAddress("!")).toBeNull()
    expect(parseRoomAddress("matrix:r/")).toBeNull()
    expect(parseRoomAddress("https://matrix.to/#/%E0%A4%A")).toBeNull()
    expect(parseRoomAddress("")).toBeNull()
  })
})
