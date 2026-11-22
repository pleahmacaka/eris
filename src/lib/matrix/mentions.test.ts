import { describe, expect, test } from "bun:test"
import {
  findMentions,
  formattedBodyOf,
  type MentionPick,
  matrixToUrl,
  mentionInsertion,
  mentionQuery,
  mentionsUser,
  messageContent,
  parseMatrixTo,
  roomOptions,
  splitByMentions,
  userOptions,
} from "./mentions"

const user = (label: string, userId: string): MentionPick => ({
  label,
  target: { kind: "user", userId },
})

const bob = user("@bob", "@bob:example.org")
const bobId = user("@bob:example.org", "@bob:example.org")
const aliceId = user("@alice:example.org", "@alice:example.org")
const general: MentionPick = {
  label: "#general",
  target: {
    kind: "room",
    roomId: "!general:example.org",
    alias: "#general:example.org",
    via: ["example.org"],
  },
}
const lobby: MentionPick = {
  label: "#로비",
  target: {
    kind: "room",
    roomId: "!lobby:example.org",
    alias: null,
    via: ["example.org", "other.org"],
  },
}
const everyone: MentionPick = { label: "@room", target: { kind: "everyone" } }

describe("mentionQuery", () => {
  test("opens on a sigil at the start of a word", () => {
    expect(mentionQuery("@bo", 3)).toEqual({
      trigger: "@",
      query: "bo",
      start: 0,
    })
    expect(mentionQuery("안녕 #gen", 7)).toEqual({
      trigger: "#",
      query: "gen",
      start: 3,
    })
    expect(mentionQuery("줄\n@", 3)).toEqual({
      trigger: "@",
      query: "",
      start: 2,
    })
  })

  test("uses only the text before the caret", () => {
    expect(mentionQuery("@bobby", 4)?.query).toBe("bob")
  })

  test("stays closed inside a word, after a space, or without a sigil", () => {
    expect(mentionQuery("mail@example", 12)).toBeNull()
    expect(mentionQuery("@bob ", 5)).toBeNull()
    expect(mentionQuery("안녕", 2)).toBeNull()
    expect(mentionQuery("", 0)).toBeNull()
  })
})

describe("findMentions", () => {
  test("finds picked labels and raw member ids as whole words", () => {
    expect(
      findMentions("@bob #general 확인, (@alice:example.org)!", [
        bob,
        general,
        aliceId,
      ]).map(span => [span.label, span.start, span.end]),
    ).toEqual([
      ["@bob", 0, 4],
      ["#general", 5, 13],
      ["@alice:example.org", 19, 37],
    ])
  })

  test("prefers the longest label at one position", () => {
    expect(
      findMentions("@bob:example.org 회의", [bob, bobId]).map(
        span => span.label,
      ),
    ).toEqual(["@bob:example.org"])
  })

  test("accepts a Korean particle glued to the label", () => {
    expect(
      findMentions("@bob님 안녕하세요", [bob]).map(span => span.end),
    ).toEqual([4])
  })

  test("does not match inside a longer word or id", () => {
    expect(findMentions("@bobby", [bob])).toEqual([])
    expect(findMentions("@bob:example.org.kr", [bobId])).toEqual([])
    expect(findMentions("mail@bob", [bob])).toEqual([])
    expect(findMentions("", [bob])).toEqual([])
  })

  test("keeps labels that contain spaces", () => {
    const kim = user("@Kim Min Su", "@kim:example.org")

    expect(findMentions("부탁해요 @Kim Min Su.", [kim])).toMatchObject([
      { start: 5, end: 16 },
    ])
  })
})

describe("splitByMentions", () => {
  test("marks the mention parts and drops empty parts", () => {
    const text = "@bob 안녕 #general"

    expect(splitByMentions(text, findMentions(text, [bob, general]))).toEqual([
      { text: "@bob", mention: true },
      { text: " 안녕 ", mention: false },
      { text: "#general", mention: true },
    ])
    expect(splitByMentions("안녕", [])).toEqual([
      { text: "안녕", mention: false },
    ])
  })
})

describe("matrix.to links", () => {
  test("builds user, alias and room id links", () => {
    expect(matrixToUrl({ kind: "user", userId: "@bob:example.org" })).toBe(
      "https://matrix.to/#/@bob:example.org",
    )
    expect(matrixToUrl(general.target as never)).toBe(
      "https://matrix.to/#/#general:example.org",
    )
    expect(matrixToUrl(lobby.target as never)).toBe(
      "https://matrix.to/#/!lobby:example.org?via=example.org&via=other.org",
    )
  })

  test("parses user links, also with an encoded sigil", () => {
    expect(parseMatrixTo("https://matrix.to/#/@bob:example.org")).toEqual({
      kind: "user",
      userId: "@bob:example.org",
    })
    expect(parseMatrixTo("https://matrix.to/#/%40bob%3Aexample.org")).toEqual({
      kind: "user",
      userId: "@bob:example.org",
    })
  })

  test("parses alias and room id links with their via servers", () => {
    expect(parseMatrixTo("https://matrix.to/#/#general:example.org")).toEqual({
      kind: "room",
      roomId: null,
      alias: "#general:example.org",
      via: [],
    })
    expect(
      parseMatrixTo(
        "https://matrix.to/#/!lobby:example.org/$event?via=example.org&via=other.org",
      ),
    ).toEqual({
      kind: "room",
      roomId: "!lobby:example.org",
      alias: null,
      via: ["example.org", "other.org"],
    })
  })

  test("rejects other links", () => {
    expect(parseMatrixTo("https://example.org/#/@bob:example.org")).toBeNull()
    expect(parseMatrixTo("https://matrix.to/#/")).toBeNull()
    expect(parseMatrixTo("https://matrix.to/#/$event")).toBeNull()
    expect(parseMatrixTo("javascript:alert(1)")).toBeNull()
  })
})

describe("messageContent", () => {
  test("keeps a plain message plain and marks it as having no mentions", () => {
    expect(messageContent("안녕하세요", [])).toEqual({
      msgtype: "m.text",
      body: "안녕하세요",
      "m.mentions": {},
    })
  })

  test("links users and rooms and lists the mentioned users once", () => {
    const text = "@bob #general #로비 봐주세요 @bob"

    expect(
      messageContent(text, findMentions(text, [bob, general, lobby])),
    ).toEqual({
      msgtype: "m.text",
      body: text,
      format: "org.matrix.custom.html",
      formatted_body:
        '<a href="https://matrix.to/#/@bob:example.org">@bob</a> ' +
        '<a href="https://matrix.to/#/#general:example.org">#general</a> ' +
        '<a href="https://matrix.to/#/!lobby:example.org?via=example.org&amp;via=other.org">#로비</a>' +
        ' 봐주세요 <a href="https://matrix.to/#/@bob:example.org">@bob</a>',
      "m.mentions": { user_ids: ["@bob:example.org"] },
    })
  })

  test("escapes markup and turns line breaks into br", () => {
    const text = '<b>굵게</b> & "따옴표"\n@bob'

    expect(messageContent(text, findMentions(text, [bob])).formatted_body).toBe(
      '&lt;b&gt;굵게&lt;/b&gt; &amp; &quot;따옴표&quot;<br><a href="https://matrix.to/#/@bob:example.org">@bob</a>',
    )
  })

  test("sets the room flag for @room without adding a link", () => {
    expect(
      messageContent("@room 공지", findMentions("@room 공지", [everyone])),
    ).toEqual({
      msgtype: "m.text",
      body: "@room 공지",
      "m.mentions": { room: true },
    })
  })
})

describe("reading events", () => {
  test("detects a mention of the user or of the whole room", () => {
    const me = "@bob:example.org"

    expect(mentionsUser({ "m.mentions": { user_ids: [me] } }, me)).toBe(true)
    expect(mentionsUser({ "m.mentions": { room: true } }, me)).toBe(true)
    expect(mentionsUser({ "m.mentions": { user_ids: ["@a:x"] } }, me)).toBe(
      false,
    )
    expect(mentionsUser({ "m.mentions": {} }, me)).toBe(false)
    expect(mentionsUser({ body: me }, me)).toBe(false)
    expect(mentionsUser({ "m.mentions": "x" }, me)).toBe(false)
  })

  test("reads a formatted body only for the HTML format", () => {
    expect(
      formattedBodyOf({
        format: "org.matrix.custom.html",
        formatted_body: "<b>a</b>",
      }),
    ).toBe("<b>a</b>")
    expect(formattedBodyOf({ formatted_body: "<b>a</b>" })).toBeNull()
    expect(formattedBodyOf({ format: "org.matrix.custom.html" })).toBeNull()
  })
})

describe("options", () => {
  const members = [
    { userId: "@alice:example.org", name: "앨리스", avatarUrl: null },
    {
      userId: "@bob:example.org",
      name: "Bob",
      avatarUrl: "mxc://example.org/b",
    },
    { userId: "@robot:example.org", name: "로봇", avatarUrl: null },
  ]

  test("filters members by name or id and ranks prefix matches first", () => {
    expect(userOptions(members, "bo", false).map(option => option.key)).toEqual(
      ["@bob:example.org", "@robot:example.org"],
    )
    expect(userOptions(members, "앨", false)).toEqual([
      {
        key: "@alice:example.org",
        kind: "user",
        title: "앨리스",
        detail: "@alice:example.org",
        avatarUrl: null,
      },
    ])
  })

  test("offers @room only with the power to notify the room", () => {
    expect(userOptions(members, "ro", true).map(option => option.kind)).toEqual(
      ["user", "everyone"],
    )
    expect(
      userOptions(members, "ro", false).map(option => option.kind),
    ).toEqual(["user"])
    expect(
      userOptions(members, "bob", true).map(option => option.kind),
    ).toEqual(["user"])
  })

  test("filters rooms by name and keeps the given order", () => {
    const rooms = [
      { id: "!a", name: "general", topic: "잡담" },
      { id: "!b", name: "개발", topic: "" },
      { id: "!c", name: "gen-2", topic: "" },
    ]

    expect(roomOptions(rooms, "gen").map(option => option.key)).toEqual([
      "!a",
      "!c",
    ])
    expect(roomOptions(rooms, "").map(option => option.title)).toEqual([
      "general",
      "개발",
      "gen-2",
    ])
    expect(roomOptions(rooms, "없음")).toEqual([])
  })
})

describe("mentionInsertion", () => {
  test("separates the mention from the text before it", () => {
    expect(mentionInsertion("@bob:example.org", "안녕")).toBe(
      " @bob:example.org ",
    )
  })

  test("adds no leading space at the start or after whitespace", () => {
    expect(mentionInsertion("@bob:example.org", "")).toBe("@bob:example.org ")
    expect(mentionInsertion("@bob:example.org", "안녕 ")).toBe(
      "@bob:example.org ",
    )
    expect(mentionInsertion("@bob:example.org", "첫 줄\n")).toBe(
      "@bob:example.org ",
    )
  })
})
