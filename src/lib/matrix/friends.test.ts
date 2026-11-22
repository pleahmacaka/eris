import { describe, expect, test } from "bun:test"
import { type FriendDigest, friendsForTab, PRESENCE_LABEL } from "./friends"

const friend = (
  name: string,
  state: FriendDigest["state"],
  presence: FriendDigest["presence"],
): FriendDigest => ({
  userId: `@${name}:example.org`,
  name,
  avatarUrl: null,
  presence,
  roomId: `!${name}:example.org`,
  state,
})

const friends = [
  friend("bob", "friend", "offline"),
  friend("alice", "friend", "online"),
  friend("dana", "friend", "unavailable"),
  friend("carol", "incoming", "online"),
  friend("erin", "outgoing", undefined),
]

const names = (list: FriendDigest[]) => list.map(item => item.name)

describe("friendsForTab", () => {
  test("online lists accepted friends who are online or away", () => {
    expect(names(friendsForTab(friends, "online", ""))).toEqual([
      "alice",
      "dana",
    ])
  })

  test("all lists accepted friends, online first", () => {
    expect(names(friendsForTab(friends, "all", ""))).toEqual([
      "alice",
      "dana",
      "bob",
    ])
  })

  test("pending lists incoming requests before outgoing ones", () => {
    expect(names(friendsForTab(friends, "pending", ""))).toEqual([
      "carol",
      "erin",
    ])
  })

  test("search matches name or user ID", () => {
    expect(names(friendsForTab(friends, "all", "BO"))).toEqual(["bob"])
    expect(names(friendsForTab(friends, "all", "dana:example"))).toEqual([
      "dana",
    ])
  })
})

describe("PRESENCE_LABEL", () => {
  test("maps presence to a status label", () => {
    expect(PRESENCE_LABEL("online")).toBe("presence.online")
    expect(PRESENCE_LABEL("unavailable")).toBe("presence.unavailable")
    expect(PRESENCE_LABEL(undefined)).toBe("presence.offline")
  })
})
