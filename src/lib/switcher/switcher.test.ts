import { describe, expect, test } from "bun:test"
import koCatalog from "#lib/i18n/messages/ko.json"
import { createTranslator } from "#lib/i18n/translate.js"
import {
  parseQuery,
  type SwitcherRoom,
  type SwitcherSpace,
  searchSwitcher,
  switcherItems,
  touchRecentRoom,
} from "./switcher"

const room = (id: string, overrides: Partial<SwitcherRoom> = {}) => ({
  id,
  name: id,
  avatarUrl: null,
  kind: "text" as const,
  isDm: false,
  unread: 0,
  ...overrides,
})

const space = (id: string, name: string): SwitcherSpace => ({
  id,
  name,
  avatarUrl: null,
  unread: 0,
})

const ERIS = space("!eris", "Eris 개발")

const PLAY = space("!play", "게임")

const ITEMS = switcherItems({
  spaces: [ERIS, PLAY],
  channels: [
    { space: ERIS, room: room("!general", { name: "general" }) },
    { space: ERIS, room: room("!dev", { name: "개발" }) },
    { space: ERIS, room: room("!lounge", { name: "라운지", kind: "voice" }) },
    { space: PLAY, room: room("!regency", { name: "regency" }) },
  ],
  dms: [
    room("!bob", { name: "Bob", isDm: true, unread: 2 }),
    room("!team", { name: "점심 모임", isDm: true }),
    room("!notes", { name: "general notes" }),
  ],
  friends: [{ roomId: "!bob", userId: "@eris-bob:example.org" }],
})

const names = (query: string, recent: string[] = []) =>
  searchSwitcher(ITEMS, query, recent).map(item => item.name)

describe("switcherItems", () => {
  test("lists conversations, then channels, then servers", () => {
    expect(ITEMS.map(item => [item.kind, item.name])).toEqual([
      ["dm", "Bob"],
      ["dm", "점심 모임"],
      ["text", "general notes"],
      ["text", "general"],
      ["text", "개발"],
      ["voice", "라운지"],
      ["text", "regency"],
      ["space", "Eris 개발"],
      ["space", "게임"],
    ])
  })

  test("describes where each item lives", () => {
    const ko = createTranslator("ko", koCatalog)
    const details = new Map(
      ITEMS.map(item => [item.name, ko(item.detail.key, item.detail.values)]),
    )

    expect(details.get("Bob")).toBe("@eris-bob:example.org")
    expect(details.get("점심 모임")).toBe("다이렉트 메시지")
    expect(details.get("general notes")).toBe("방")
    expect(details.get("general")).toBe("Eris 개발")
    expect(details.get("게임")).toBe("서버")
  })

  test("targets a room, with its server, or a server alone", () => {
    const target = (name: string) => {
      const item = ITEMS.find(candidate => candidate.name === name)

      return [item?.spaceId, item?.roomId]
    }

    expect(target("Bob")).toEqual([null, "!bob"])
    expect(target("general")).toEqual(["!eris", "!general"])
    expect(target("게임")).toEqual(["!play", null])
    expect(new Set(ITEMS.map(item => item.key)).size).toBe(ITEMS.length)
  })
})

describe("parseQuery", () => {
  test("reads a leading filter character", () => {
    expect(parseQuery("#gen")).toEqual({
      kinds: ["text"],
      needle: ["g", "e", "n"],
    })
    expect(parseQuery("@bob").kinds).toEqual(["dm"])
    expect(parseQuery("!라").kinds).toEqual(["voice"])
    expect(parseQuery(" *eris").kinds).toEqual(["space"])
    expect(parseQuery("#")).toEqual({ kinds: ["text"], needle: [] })
  })

  test("searches everything without a filter", () => {
    expect(parseQuery("gen")).toEqual({ kinds: null, needle: ["g", "e", "n"] })
    expect(parseQuery("")).toEqual({ kinds: null, needle: [] })
  })
})

describe("searchSwitcher", () => {
  test("narrows the list by filter character", () => {
    expect(names("@")).toEqual(["Bob", "점심 모임"])
    expect(names("#")).toEqual(["general notes", "general", "개발", "regency"])
    expect(names("!")).toEqual(["라운지"])
    expect(names("*")).toEqual(["Eris 개발", "게임"])
  })

  test("drops items that do not match", () => {
    expect(names("zzz")).toEqual([])
    expect(names("@gen")).toEqual([])
  })

  test("ranks a prefix first and a mid-word match last", () => {
    expect(names("gen")).toEqual(["general", "general notes", "regency"])
  })

  test("finds a person by user id below matches on the name", () => {
    expect(names("eris")).toEqual(["Eris 개발", "Bob"])
    expect(names("@eris-bob")).toEqual(["Bob"])
    expect(names("@eris-bob:example.org")).toEqual(["Bob"])
  })

  test("does not match letters scattered across a user id", () => {
    expect(names("@ebx")).toEqual([])
  })

  test("matches Hangul names while a syllable is being composed", () => {
    expect(names("갭")).toEqual(["개발", "Eris 개발"])
    expect(names("ㄹㅇㅈ")).toEqual(["라운지"])
  })

  test("lists recent rooms first when the query is empty", () => {
    expect(names("", ["!dev", "!bob"])).toEqual([
      "개발",
      "Bob",
      "점심 모임",
      "general notes",
      "general",
      "라운지",
      "regency",
      "Eris 개발",
      "게임",
    ])
  })

  test("lets a recent room win a tie, not a better match", () => {
    expect(names("#g", [])).toEqual(["general", "general notes", "regency"])
    expect(names("#g", ["!notes"])).toEqual([
      "general notes",
      "general",
      "regency",
    ])
    expect(names("gen", ["!regency"])).toEqual([
      "general",
      "general notes",
      "regency",
    ])
  })
})

describe("touchRecentRoom", () => {
  test("moves a room to the front without duplicates", () => {
    expect(touchRecentRoom(["!a", "!b", "!c"], "!b")).toEqual([
      "!b",
      "!a",
      "!c",
    ])
    expect(touchRecentRoom([], "!a")).toEqual(["!a"])
  })

  test("keeps the twenty most recent rooms", () => {
    const many = Array.from({ length: 25 }, (_, index) => `!room${index}`)
    const touched = touchRecentRoom(many, "!new")

    expect(touched).toHaveLength(20)
    expect(touched[0]).toBe("!new")
    expect(touched[19]).toBe("!room18")
  })
})
