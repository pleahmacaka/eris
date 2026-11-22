import { describe, expect, test } from "bun:test"
import { eventPermalink, roomPermalink, viaServers } from "./links"
import { parseRoomAddress } from "./spaces"

describe("viaServers", () => {
  test("ranks servers by member count, then by name", () => {
    expect(
      viaServers([
        "@a:one.org",
        "@b:two.org",
        "@c:two.org",
        "@d:alpha.org",
        "@e:three.org",
      ]),
    ).toEqual(["two.org", "alpha.org", "one.org"])
  })

  test("keeps ports and skips ids without a server", () => {
    expect(viaServers(["@a:example.org:8448", "broken"])).toEqual([
      "example.org:8448",
    ])
    expect(viaServers([])).toEqual([])
  })
})

describe("roomPermalink", () => {
  test("encodes a room id and appends the via servers", () => {
    expect(roomPermalink("!abc:example.org", ["example.org", "b.org"])).toBe(
      "https://matrix.to/#/!abc%3Aexample.org?via=example.org&via=b.org",
    )
  })

  test("links an alias without via servers", () => {
    expect(roomPermalink("#eris:example.org", ["example.org"])).toBe(
      "https://matrix.to/#/%23eris%3Aexample.org",
    )
  })

  test("round-trips through the join address parser", () => {
    expect(
      parseRoomAddress(roomPermalink("!v12RoomId", ["example.org:8448"])),
    ).toEqual({ target: "!v12RoomId", via: ["example.org:8448"] })
    expect(parseRoomAddress(roomPermalink("#eris:example.org"))).toEqual({
      target: "#eris:example.org",
      via: ["example.org"],
    })
  })
})

describe("eventPermalink", () => {
  test("links one event inside its room", () => {
    expect(eventPermalink("!abc:example.org", "$event", ["example.org"])).toBe(
      "https://matrix.to/#/!abc%3Aexample.org/%24event?via=example.org",
    )
  })

  test("resolves to the room in the join address parser", () => {
    expect(
      parseRoomAddress(eventPermalink("!v12RoomId", "$event", ["a.org"])),
    ).toEqual({ target: "!v12RoomId", via: ["a.org"] })
  })
})
