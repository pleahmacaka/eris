import { describe, expect, test } from "bun:test"
import koCatalog from "#lib/i18n/messages/ko.json"
import { createTranslator, type Message } from "#lib/i18n/translate.js"
import {
  type EventDigest,
  groupMessages,
  type MembershipChange,
  membershipMessage,
  singleLine,
  toTimelineItem,
  withDaySeparators,
} from "./timeline"

const ko = createTranslator("ko", koCatalog)

const korean = (message: Message | null) =>
  message === null ? null : ko(message.key, message.values)

const membershipText = (change: MembershipChange) =>
  korean(membershipMessage(change))

const digest = (overrides: Partial<EventDigest>): EventDigest => ({
  id: "$1",
  type: "m.room.message",
  senderId: "@alice:example.org",
  senderName: "alice",
  senderAvatarUrl: null,
  ts: Date.UTC(2026, 10, 22, 3, 4),
  content: { msgtype: "m.text", body: "hello" },
  prevContent: {},
  pending: false,
  redacted: false,
  highlight: false,
  ...overrides,
})

describe("membershipText", () => {
  const base = { senderName: "alice", targetName: "bob", self: false }

  test("maps joins, invites and leaves to compact Korean notices", () => {
    expect(membershipText({ ...base, membership: "join" })).toBe(
      "bob님이 참여했습니다",
    )
    expect(membershipText({ ...base, membership: "invite" })).toBe(
      "alice님이 bob님을 초대했습니다",
    )
    expect(
      membershipText({ ...base, membership: "leave", prevMembership: "join" }),
    ).toBe("alice님이 bob님을 내보냈습니다")
  })

  test("distinguishes a self leave from a declined invite", () => {
    expect(
      membershipText({
        ...base,
        targetName: "alice",
        self: true,
        membership: "leave",
        prevMembership: "join",
      }),
    ).toBe("alice님이 나갔습니다")
    expect(
      membershipText({
        ...base,
        targetName: "alice",
        self: true,
        membership: "leave",
        prevMembership: "invite",
      }),
    ).toBe("alice님이 초대를 거절했습니다")
  })

  test("treats join over join as a profile change", () => {
    expect(
      membershipText({ ...base, membership: "join", prevMembership: "join" }),
    ).toBe("bob님이 프로필을 수정했습니다")
  })
})

describe("toTimelineItem", () => {
  test("turns a text message into a message item", () => {
    const item = toTimelineItem(digest({}), "@alice:example.org")

    expect(item).toMatchObject({ kind: "message", body: "hello", mine: true })
  })

  test("turns a membership event into a notice", () => {
    const item = toTimelineItem(
      digest({
        type: "m.room.member",
        stateKey: "@bob:example.org",
        targetName: "bob",
        content: { membership: "invite" },
      }),
      "@me:example.org",
    )

    expect(item?.kind).toBe("notice")
    expect(item?.kind === "notice" && korean(item.message)).toBe(
      "alice님이 bob님을 초대했습니다",
    )
  })

  test("drops events that have no compact form", () => {
    expect(
      toTimelineItem(digest({ type: "m.call.candidates" }), "@me:example.org"),
    ).toBeNull()
    expect(
      toTimelineItem(digest({ content: { body: "" } }), "@me:example.org"),
    ).toBeNull()
  })

  test("shows redacted messages as a notice", () => {
    expect(
      toTimelineItem(digest({ redacted: true }), "@me:example.org"),
    ).toMatchObject({
      kind: "notice",
      message: { key: "timeline.message.deleted" },
    })
  })
})

describe("groupMessages", () => {
  const message = (id: string, senderId: string, ts: number) => ({
    kind: "message" as const,
    id,
    senderId,
    senderName: senderId,
    senderAvatarUrl: null,
    body: id,
    formattedBody: null,
    attachment: null,
    mentionsMe: false,
    ts,
    mine: false,
    pending: false,
  })

  test("continues runs from one sender inside the window", () => {
    const items = groupMessages([
      message("a", "@x", 0),
      message("b", "@x", 60_000),
      message("c", "@y", 61_000),
      message("d", "@y", 61_000 + 5 * 60_000),
    ])

    expect(
      items.map(item => item.kind === "message" && item.continued),
    ).toEqual([false, true, false, false])
  })

  test("breaks a run at notices and day separators", () => {
    const items = groupMessages([
      message("a", "@x", 0),
      {
        kind: "notice",
        id: "n",
        message: { key: "timeline.call.ended" },
        ts: 1,
      },
      message("b", "@x", 2),
    ])

    expect(
      items.map(item => item.kind === "message" && item.continued),
    ).toEqual([false, false, false])
  })
})

describe("day separators", () => {
  test("inserts one day separator per calendar day", () => {
    const first = new Date(2026, 0, 5, 9).getTime()
    const second = new Date(2026, 0, 5, 10).getTime()
    const third = new Date(2026, 0, 6, 10).getTime()
    const items = withDaySeparators([
      {
        kind: "notice",
        id: "a",
        message: { key: "timeline.call.ended" },
        ts: first,
      },
      {
        kind: "notice",
        id: "b",
        message: { key: "timeline.call.ended" },
        ts: second,
      },
      {
        kind: "notice",
        id: "c",
        message: { key: "timeline.call.ended" },
        ts: third,
      },
    ])

    expect(items.map(item => item.kind)).toEqual([
      "day",
      "notice",
      "notice",
      "day",
      "notice",
    ])
  })

  test("flattens and truncates preview text", () => {
    expect(singleLine("a\nb")).toBe("a b")
    expect(singleLine("x".repeat(100), 10)).toBe("xxxxxxxxx…")
  })
})
