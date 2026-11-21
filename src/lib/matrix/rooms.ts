import type { Message } from "#lib/i18n/translate.js"
import type { ChannelKind } from "./spaces"
import { type EventDigest, singleLine, toTimelineItem } from "./timeline"

export type CallMemberDigest = {
  userId: string
  deviceId: string
  name: string
  avatarUrl: string | null
}

export type RoomDigest = {
  id: string
  name: string
  avatarUrl: string | null
  membership: string
  kind: ChannelKind
  topic: string
  lastEvent: EventDigest | null
  lastActiveTs: number
  unread: number
  highlight: number
  isDm: boolean
  joinedCount: number
  inviter: string | null
  callMembers: CallMemberDigest[]
  via: string[]
  order: string | undefined
  childTs: number
}

export const roomPreview = (
  event: EventDigest | null,
  myUserId: string,
): Message | null => {
  const item = event === null ? null : toTimelineItem(event, myUserId)

  if (item === null) {
    return null
  }

  if (item.kind === "notice") {
    return item.message
  }

  const body = singleLine(item.body)

  return item.mine
    ? { key: "timeline.preview.mine", values: { body } }
    : { key: "timeline.preview.other", values: { name: item.senderName, body } }
}

const byActivity = (a: RoomDigest, b: RoomDigest) =>
  b.lastActiveTs - a.lastActiveTs || a.name.localeCompare(b.name, "ko")

export const joinedRooms = (rooms: RoomDigest[]) =>
  rooms.filter(room => room.membership === "join").sort(byActivity)

export const invitedRooms = (rooms: RoomDigest[]) =>
  rooms.filter(room => room.membership === "invite").sort(byActivity)

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

export const roomInitial = (name: string) => {
  const stripped = name.replace(/^[#@!]+/, "").trim()
  const [first] = graphemes.segment(stripped)

  return first ? first.segment.toUpperCase() : "?"
}

export const localpart = (userId: string) => {
  const body = userId.startsWith("@") ? userId.slice(1) : userId
  const colon = body.indexOf(":")

  return colon === -1 ? body : body.slice(0, colon)
}

export const serverName = (userId: string) => {
  const colon = userId.indexOf(":")

  return colon === -1 ? "" : userId.slice(colon + 1)
}

export const dmPeers = (direct: Record<string, unknown>, roomId: string) =>
  Object.entries(direct)
    .filter(([, roomIds]) => Array.isArray(roomIds) && roomIds.includes(roomId))
    .map(([userId]) => userId)
