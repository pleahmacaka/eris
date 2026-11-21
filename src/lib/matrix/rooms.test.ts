import { describe, expect, test } from "bun:test"
import koCatalog from "#lib/i18n/messages/ko.json"
import { createTranslator } from "#lib/i18n/translate.js"
import {
  dmPeers,
  invitedRooms,
  joinedRooms,
  localpart,
  type RoomDigest,
  roomInitial,
  roomPreview,
  serverName,
} from "./rooms"

const ko = createTranslator("ko", koCatalog)

const previewText = (...args: Parameters<typeof roomPreview>) => {
  const message = roomPreview(...args)
  return message === null ? "" : ko(message.key, message.values)
}

const room = (overrides: Partial<RoomDigest>): RoomDigest => ({
  id: "!a:example.org",
  name: "A",
  avatarUrl: null,
  membership: "join",
  lastEvent: null,
  lastActiveTs: 0,
  unread: 0,
  isDm: false,
  joinedCount: 2,
  inviter: null,
  kind: "text",
  topic: "",
  highlight: 0,
  callMembers: [],
  via: [],
  order: undefined,
  childTs: 0,
  ...overrides,
})

describe("room lists", () => {
  test("sorts joined rooms by latest activity and keeps invites apart", () => {
    const rooms = [
      room({ id: "!old", name: "Old", lastActiveTs: 10 }),
      room({ id: "!new", name: "New", lastActiveTs: 30 }),
      room({
        id: "!inv",
        name: "Invite",
        membership: "invite",
        lastActiveTs: 50,
      }),
      room({ id: "!mid", name: "Mid", lastActiveTs: 20 }),
    ]

    expect(joinedRooms(rooms).map(r => r.id)).toEqual(["!new", "!mid", "!old"])
    expect(invitedRooms(rooms).map(r => r.id)).toEqual(["!inv"])
  })

  test("breaks activity ties by name", () => {
    const rooms = [
      room({ id: "!b", name: "나" }),
      room({ id: "!a", name: "가" }),
    ]

    expect(joinedRooms(rooms).map(r => r.name)).toEqual(["가", "나"])
  })
})

describe("roomPreview", () => {
  const event = {
    id: "$1",
    type: "m.room.message",
    senderId: "@bob:example.org",
    senderName: "bob",
    senderAvatarUrl: null,
    ts: 1,
    content: { body: "first line\nsecond line" },
    prevContent: {},
    pending: false,
    redacted: false,
    highlight: false,
  }

  test("prefixes the sender and flattens newlines", () => {
    expect(previewText(event, "@me:example.org")).toBe(
      "bob: first line second line",
    )
  })

  test("uses 나 for my own messages", () => {
    expect(previewText(event, "@bob:example.org")).toBe(
      "나: first line second line",
    )
  })

  test("falls back to the notice text or empty", () => {
    expect(
      previewText(
        {
          ...event,
          type: "m.room.member",
          stateKey: "@bob:example.org",
          targetName: "bob",
          content: { membership: "join" },
        },
        "@me:example.org",
      ),
    ).toBe("bob님이 참여했습니다")
    expect(previewText(null, "@me:example.org")).toBe("")
  })
})

describe("names", () => {
  test("picks an avatar initial without room sigils", () => {
    expect(roomInitial("#eris:example.org")).toBe("E")
    expect(roomInitial("회의실")).toBe("회")
    expect(roomInitial("")).toBe("?")
  })

  test("falls back to a whole character for user names", () => {
    expect(roomInitial("@eris-alice:example.org")).toBe("E")
    expect(roomInitial("  봄날 ")).toBe("봄")
    expect(roomInitial("🇰🇷 서울")).toBe("🇰🇷")
    expect(roomInitial("👩‍💻 dev")).toBe("👩‍💻")
    expect(roomInitial("   ")).toBe("?")
  })

  test("extracts the localpart and server of a user id", () => {
    expect(localpart("@eris-alice:example.org")).toBe("eris-alice")
    expect(localpart("plain")).toBe("plain")
    expect(serverName("@eris-alice:example.org")).toBe("example.org")
    expect(serverName("plain")).toBe("")
  })
})

describe("dmPeers", () => {
  const direct = {
    "@bob:example.org": ["!one", "!group"],
    "@carol:example.org": ["!group"],
    "@broken:example.org": "!one",
  }

  test("lists the users whose direct rooms include the room", () => {
    expect(dmPeers(direct, "!one")).toEqual(["@bob:example.org"])
    expect(dmPeers(direct, "!group")).toEqual([
      "@bob:example.org",
      "@carol:example.org",
    ])
    expect(dmPeers(direct, "!none")).toEqual([])
  })
})
