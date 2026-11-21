import type { MessageKey } from "#lib/i18n/catalogs.js"
import type { Message } from "#lib/i18n/translate.js"
import { type AttachmentDigest, parseAttachment } from "./attachments"
import { formattedBodyOf, mentionsUser } from "./mentions"

export type EventDigest = {
  id: string
  type: string
  senderId: string
  senderName: string
  senderAvatarUrl: string | null
  ts: number
  content: Record<string, unknown>
  prevContent: Record<string, unknown>
  stateKey?: string
  targetName?: string
  pending: boolean
  redacted: boolean
  highlight: boolean
}

export type MessageItem = {
  kind: "message"
  id: string
  senderId: string
  senderName: string
  senderAvatarUrl: string | null
  body: string
  formattedBody: string | null
  attachment: AttachmentDigest | null
  mentionsMe: boolean
  ts: number
  mine: boolean
  pending: boolean
}

export type NoticeItem = {
  kind: "notice"
  id: string
  message: Message
  ts: number
}

export type DayItem = {
  kind: "day"
  id: string
  ts: number
}

export type TimelineItem = MessageItem | NoticeItem | DayItem

export type MembershipChange = {
  membership: string
  prevMembership?: string
  senderName: string
  targetName: string
  self: boolean
}

const leaveMessage = (
  prevMembership: string | undefined,
  self: boolean,
): MessageKey => {
  if (self) {
    return prevMembership === "invite"
      ? "timeline.member.declined"
      : "timeline.member.left"
  }

  return prevMembership === "invite"
    ? "timeline.member.inviteRevoked"
    : "timeline.member.kicked"
}

const membershipKey = ({
  membership,
  prevMembership,
  self,
}: MembershipChange): MessageKey | null => {
  switch (membership) {
    case "join":
      return prevMembership === "join"
        ? "timeline.member.profileChanged"
        : "timeline.member.joined"
    case "invite":
      return "timeline.member.invited"
    case "ban":
      return "timeline.member.banned"
    case "knock":
      return "timeline.member.knocked"
    case "leave":
      return leaveMessage(prevMembership, self)
    default:
      return null
  }
}

export const membershipMessage = (change: MembershipChange): Message | null => {
  const key = membershipKey(change)

  return key === null
    ? null
    : {
        key,
        values: { sender: change.senderName, target: change.targetName },
      }
}

const text = (value: unknown) => (typeof value === "string" ? value : "")

const SENDER_NOTICES: Record<string, MessageKey> = {
  "m.room.create": "timeline.room.created",
  "m.room.topic": "timeline.room.topicChanged",
  "m.call.invite": "timeline.call.started",
  "m.call.reject": "timeline.call.declined",
}

const noticeFor = (event: EventDigest): Message | null => {
  const senderKey = SENDER_NOTICES[event.type]

  if (senderKey) {
    return { key: senderKey, values: { sender: event.senderName } }
  }

  switch (event.type) {
    case "m.room.member":
      return membershipMessage({
        membership: text(event.content.membership),
        prevMembership: text(event.prevContent.membership) || undefined,
        senderName: event.senderName,
        targetName: event.targetName ?? event.stateKey ?? event.senderName,
        self: event.stateKey === event.senderId,
      })
    case "m.room.name":
      return {
        key: "timeline.room.renamed",
        values: { sender: event.senderName, name: text(event.content.name) },
      }
    case "m.call.hangup":
      return { key: "timeline.call.ended" }
    default:
      return null
  }
}

export const toTimelineItem = (
  event: EventDigest,
  myUserId: string,
): MessageItem | NoticeItem | null => {
  if (event.type === "m.room.message") {
    if (event.redacted) {
      return {
        kind: "notice",
        id: event.id,
        message: { key: "timeline.message.deleted" },
        ts: event.ts,
      }
    }

    const body = text(event.content.body)
    const attachment = parseAttachment(event.content)

    if (body === "" && attachment === null) {
      return null
    }

    return {
      kind: "message",
      id: event.id,
      senderId: event.senderId,
      senderName: event.senderName,
      senderAvatarUrl: event.senderAvatarUrl,
      body,
      formattedBody: formattedBodyOf(event.content),
      attachment,
      mentionsMe:
        event.senderId !== myUserId &&
        (event.highlight || mentionsUser(event.content, myUserId)),
      ts: event.ts,
      mine: event.senderId === myUserId,
      pending: event.pending,
    }
  }

  const notice = noticeFor(event)

  return notice === null
    ? null
    : { kind: "notice", id: event.id, message: notice, ts: event.ts }
}

export const sameDay = (a: number, b: number) => {
  const left = new Date(a)
  const right = new Date(b)

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export const withDaySeparators = (
  items: (MessageItem | NoticeItem)[],
): TimelineItem[] => {
  const result: TimelineItem[] = []
  let previous: number | null = null

  for (const item of items) {
    if (previous === null || !sameDay(previous, item.ts)) {
      result.push({ kind: "day", id: `day-${item.ts}`, ts: item.ts })
    }

    result.push(item)
    previous = item.ts
  }

  return result
}

export type ChatMessage = MessageItem & { continued: boolean }

export type ChatItem = ChatMessage | NoticeItem | DayItem

export const GROUP_WINDOW_MS = 5 * 60_000

export const groupMessages = (items: TimelineItem[]): ChatItem[] => {
  let previous: MessageItem | null = null

  return items.map(item => {
    if (item.kind !== "message") {
      previous = null

      return item
    }

    const continued =
      previous !== null &&
      previous.senderId === item.senderId &&
      item.ts - previous.ts < GROUP_WINDOW_MS

    previous = item

    return { ...item, continued }
  })
}

export const singleLine = (value: string, limit = 80) => {
  const flat = value.split("\n").join(" ").trim()

  return flat.length > limit ? `${flat.slice(0, limit - 1)}…` : flat
}
