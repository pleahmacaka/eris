import {
  EventStatus,
  EventType,
  type HierarchyRoom,
  type MatrixClient,
  type MatrixEvent,
  NotificationCountType,
  type Room,
  type RoomMember,
} from "matrix-js-sdk"
import type { CallMembership } from "matrix-js-sdk/lib/matrixrtc"
import type { MembershipDigest } from "./groupCall"
import type { MemberDigest, Presence } from "./members"
import { localpart, type RoomDigest } from "./rooms"
import { channelKind, type SpaceChildLink } from "./spaces"
import { type EventDigest, toTimelineItem } from "./timeline"

const text = (value: unknown) => (typeof value === "string" ? value : "")

export const memberAvatarUrl = (member: RoomMember | null | undefined) =>
  member?.getMxcAvatarUrl() || null

export const roomAvatarUrl = (room: Room) => room.getMxcAvatarUrl() || null

export const digestEvent = (room: Room, event: MatrixEvent): EventDigest => {
  const senderId = event.getSender() ?? ""
  const stateKey = event.getStateKey()
  const content = event.getContent()

  return {
    id: event.getId() ?? event.getTxnId() ?? `${senderId}-${event.getTs()}`,
    type: event.getType(),
    senderId,
    senderName: room.getMember(senderId)?.name ?? senderId,
    senderAvatarUrl: memberAvatarUrl(room.getMember(senderId)),
    ts: event.getTs(),
    content,
    prevContent: event.getPrevContent(),
    stateKey,
    targetName: stateKey
      ? text(content.displayname) || room.getMember(stateKey)?.name || stateKey
      : undefined,
    pending: event.status !== null && event.status !== EventStatus.SENT,
    redacted: event.isRedacted(),
    highlight:
      room.client.getPushActionsForEvent(event)?.tweaks?.highlight === true,
  }
}

const lastVisibleEvent = (room: Room, myUserId: string): EventDigest | null => {
  const events = room.getLiveTimeline().getEvents()

  for (let index = events.length - 1; index >= 0; index--) {
    const digest = digestEvent(room, events[index])

    if (toTimelineItem(digest, myUserId) !== null) {
      return digest
    }
  }

  return null
}

export const dmRoomIds = (client: MatrixClient) => {
  const content = client.getAccountData(EventType.Direct)?.getContent() ?? {}

  return new Set(
    Object.values(content).flatMap(ids => (Array.isArray(ids) ? ids : [])),
  )
}

export const roomTopic = (room: Room) =>
  text(
    room.currentState.getStateEvents(EventType.RoomTopic, "")?.getContent()
      .topic,
  )

export const digestRoom = (
  client: MatrixClient,
  room: Room,
  dms: Set<string>,
  link?: SpaceChildLink,
): RoomDigest => {
  const myUserId = client.getUserId() ?? ""
  const membership = room.getMyMembership()
  const joined = membership === "join"

  return {
    id: room.roomId,
    name: room.name,
    avatarUrl:
      roomAvatarUrl(room) ??
      (dms.has(room.roomId)
        ? memberAvatarUrl(room.getAvatarFallbackMember())
        : null),
    membership,
    kind: channelKind(room.getType()),
    topic: roomTopic(room),
    lastEvent: lastVisibleEvent(room, myUserId),
    lastActiveTs: room.getLastActiveTimestamp(),
    unread: room.getUnreadNotificationCount(NotificationCountType.Total),
    highlight: room.getUnreadNotificationCount(NotificationCountType.Highlight),
    isDm: dms.has(room.roomId),
    joinedCount: room.getJoinedMemberCount(),
    inviter:
      membership === "invite"
        ? (room.getMember(myUserId)?.events.member?.getSender() ?? null)
        : null,
    callMembers: joined
      ? client.matrixRTC.getRoomSession(room).memberships.map(member => ({
          userId: member.userId,
          deviceId: member.deviceId,
          name: room.getMember(member.userId)?.name ?? localpart(member.userId),
          avatarUrl: memberAvatarUrl(room.getMember(member.userId)),
        }))
      : [],
    via: link?.via ?? [],
    order: link?.order,
    childTs: link?.ts ?? 0,
  }
}

export const digestHierarchyRoom = (
  info: HierarchyRoom,
  link: SpaceChildLink,
): RoomDigest => ({
  id: info.room_id,
  name: info.name ?? info.canonical_alias ?? info.room_id,
  avatarUrl: info.avatar_url || null,
  membership: "none",
  kind: channelKind(info.room_type),
  topic: info.topic ?? "",
  lastEvent: null,
  lastActiveTs: 0,
  unread: 0,
  highlight: 0,
  isDm: false,
  joinedCount: info.num_joined_members,
  inviter: null,
  callMembers: [],
  via: link.via,
  order: link.order,
  childTs: link.ts,
})

export const spaceChildLinks = (space: Room): SpaceChildLink[] =>
  space.currentState.getStateEvents(EventType.SpaceChild).flatMap(event => {
    const roomId = event.getStateKey()
    const content = event.getContent()
    const via = Array.isArray(content.via)
      ? content.via.filter((item): item is string => typeof item === "string")
      : []

    return roomId && via.length > 0
      ? [
          {
            roomId,
            via,
            order:
              typeof content.order === "string" ? content.order : undefined,
            ts: event.getTs(),
          },
        ]
      : []
  })

export const digestMember = (
  client: MatrixClient,
  member: RoomMember,
): MemberDigest => ({
  userId: member.userId,
  name: member.name,
  avatarUrl: memberAvatarUrl(member),
  powerLevel: member.powerLevel,
  presence: client.getUser(member.userId)?.presence as Presence,
})

export const digestMembership = (
  membership: CallMembership,
): MembershipDigest => ({
  userId: membership.userId,
  deviceId: membership.deviceId,
  memberId: membership.memberId,
  createdTs: membership.createdTs(),
  transport: membership.getTransport(),
})
