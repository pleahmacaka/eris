import { describe, expect, test } from "bun:test"
import {
  channelsPath,
  HOME_PATH,
  homeViewPath,
  isChatPath,
  parseChannelsPath,
  parseHomeView,
} from "./routes"

describe("channelsPath", () => {
  test("builds home, DM, space and channel paths", () => {
    expect(channelsPath({ spaceId: null, roomId: null })).toBe(HOME_PATH)
    expect(channelsPath({ spaceId: null, roomId: "!dm:example.org" })).toBe(
      "/channels/@me/!dm%3Aexample.org",
    )
    expect(channelsPath({ spaceId: "!s:example.org", roomId: null })).toBe(
      "/channels/!s%3Aexample.org",
    )
    expect(
      channelsPath({ spaceId: "!s:example.org", roomId: "!r:example.org" }),
    ).toBe("/channels/!s%3Aexample.org/!r%3Aexample.org")
  })
})

describe("parseChannelsPath", () => {
  test("round-trips every shape", () => {
    const routes = [
      { spaceId: null, roomId: null },
      { spaceId: null, roomId: "!dm:example.org" },
      { spaceId: "!s:example.org", roomId: null },
      { spaceId: "!s:example.org", roomId: "!r:example.org" },
    ]

    for (const route of routes) {
      expect(parseChannelsPath(channelsPath(route))).toEqual(route)
    }
  })

  test("accepts already-decoded ids", () => {
    expect(parseChannelsPath("/channels/@me/!dm:example.org")).toEqual({
      spaceId: null,
      roomId: "!dm:example.org",
    })
  })

  test("rejects paths outside the channels family", () => {
    expect(parseChannelsPath("/login")).toBeNull()
    expect(parseChannelsPath("/channels")).toBeNull()
    expect(parseChannelsPath("/channels/@me/a/b")).toBeNull()
  })

  test("tells chat paths from list paths", () => {
    expect(isChatPath("/channels/@me")).toBe(false)
    expect(isChatPath("/channels/@me/!dm:example.org")).toBe(true)
    expect(isChatPath("/settings")).toBe(false)
  })

  test("treats home views as pages, not rooms", () => {
    expect(parseChannelsPath(homeViewPath("friends"))).toEqual({
      spaceId: null,
      roomId: null,
    })
    expect(isChatPath(homeViewPath("home"))).toBe(false)
  })
})

describe("parseHomeView", () => {
  test("recognises the friends and home pages only under @me", () => {
    expect(parseHomeView("/channels/@me/friends")).toBe("friends")
    expect(parseHomeView("/channels/@me/home")).toBe("home")
    expect(parseHomeView("/channels/@me")).toBeNull()
    expect(parseHomeView("/channels/@me/!dm:example.org")).toBeNull()
    expect(parseHomeView("/channels/!s:example.org/friends")).toBeNull()
  })
})
