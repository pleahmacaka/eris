import {
  EventType,
  type IPowerLevelsContent,
  type ISendEventResponse,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  type RoomMember,
  RoomStateEvent,
} from "matrix-js-sdk"
import {
  memberAvatarUrl,
  roomAvatarUrl,
  roomTopic,
  spaceChildLinks,
} from "./digest"
import { eventPermalink, roomPermalink, viaServers } from "./links"
import {
  applyPermissionLevels,
  fieldLevel,
  type PermissionLevels,
  type PowerContent,
  type Standing,
  userLevel,
} from "./power"
import { dmPeers } from "./rooms"

const STATE_ECHO_MS = 10_000

export const applyState = async (
  client: MatrixClient,
  send: () => Promise<ISendEventResponse>,
) => {
  const seen = new Set<string>()
  let sentId: string | null = null
  let settle: () => void = () => undefined
  const echoed = new Promise<void>(resolve => {
    settle = resolve
  })
  const onState = (event: MatrixEvent) => {
    const id = event.getId()

    if (id !== undefined) {
      seen.add(id)
    }

    if (id === sentId) {
      settle()
    }
  }
  const timer = setTimeout(settle, STATE_ECHO_MS)

  // the server accepts a state event before sync applies it locally; callers read local state right after
  client.on(RoomStateEvent.Events, onState)

  try {
    sentId = (await send()).event_id

    if (!seen.has(sentId)) {
      await echoed
    }
  } finally {
    clearTimeout(timer)
    client.off(RoomStateEvent.Events, onState)
  }
}

export const markRoomsRead = async (
  client: MatrixClient,
  roomIds: string[],
) => {
  await Promise.all(
    roomIds.map(async roomId => {
      const room = client.getRoom(roomId)
      const last =
        room?.getMyMembership() === "join"
          ? room
              .getLiveTimeline()
              .getEvents()
              .findLast(event => event.status === null)
          : undefined

      if (last) {
        await client.sendReadReceipt(last)
      }
    }),
  )
}

export const spaceChildIds = (client: MatrixClient, spaceId: string) => {
  const space = client.getRoom(spaceId)

  return space ? spaceChildLinks(space).map(link => link.roomId) : []
}

export const inviteUsers = async (
  client: MatrixClient,
  roomId: string,
  userIds: string[],
) => {
  for (const userId of userIds) {
    await client.invite(roomId, userId)
  }
}

const viaFor = (client: MatrixClient, room: Room | null, listed: string[]) =>
  room === null && listed.length > 0
    ? listed
    : viaServers([
        ...(room?.getJoinedMembers().map(member => member.userId) ?? []),
        client.getUserId() ?? "",
      ])

export const roomLink = (
  client: MatrixClient,
  roomId: string,
  listed: string[] = [],
) => {
  const room = client.getRoom(roomId)
  const alias = room?.getCanonicalAlias()

  return alias
    ? roomPermalink(alias)
    : roomPermalink(roomId, viaFor(client, room, listed))
}

export const eventLink = (
  client: MatrixClient,
  roomId: string,
  eventId: string,
) => eventPermalink(roomId, eventId, viaFor(client, client.getRoom(roomId), []))

export const dmPeerId = (client: MatrixClient, roomId: string) => {
  const peers = dmPeers(
    client.getAccountData(EventType.Direct)?.getContent() ?? {},
    roomId,
  )

  return peers.length === 1 ? (peers[0] ?? null) : null
}

export const powerContent = (room: Room): PowerContent =>
  room.currentState
    .getStateEvents(EventType.RoomPowerLevels, "")
    ?.getContent() ?? {}

export const memberLevel = (room: Room, userId: string) =>
  room.getMember(userId)?.powerLevel ?? userLevel(powerContent(room), userId)

export const standing = (
  room: Room,
  myUserId: string,
  userId: string,
): Standing => ({
  actor: memberLevel(room, myUserId),
  target: memberLevel(room, userId),
  self: myUserId === userId,
})

export const setUserLevel = (
  client: MatrixClient,
  room: Room,
  userId: string,
  level: number,
) =>
  applyState(client, () =>
    client.setPowerLevel(
      room.roomId,
      userId,
      level === fieldLevel(powerContent(room), "users_default")
        ? undefined
        : level,
    ),
  )

export const savePermissions = async (
  client: MatrixClient,
  room: Room,
  levels: PermissionLevels,
) => {
  const content = powerContent(room)
  const next = applyPermissionLevels(
    content,
    levels,
    memberLevel(room, client.getUserId() ?? ""),
  )

  if (next !== content) {
    await applyState(client, () =>
      client.sendStateEvent(
        room.roomId,
        EventType.RoomPowerLevels,
        next as IPowerLevelsContent,
        "",
      ),
    )
  }
}

export type AdminMember = {
  userId: string
  name: string
  avatarUrl: string | null
  level: number
  invited: boolean
}

export type RoomAdmin = {
  room: Room
  name: string
  topic: string
  avatarUrl: string | null
  myUserId: string
  myLevel: number
  content: PowerContent
  members: AdminMember[]
  banned: AdminMember[]
  canInvite: boolean
  link: string
}

const adminMember = (member: RoomMember): AdminMember => ({
  userId: member.userId,
  name: member.name,
  avatarUrl: memberAvatarUrl(member),
  level: member.powerLevel,
  invited: member.membership === "invite",
})

const byRank = (a: AdminMember, b: AdminMember) =>
  b.level - a.level || a.name.localeCompare(b.name, "ko")

export const roomAdmin = (client: MatrixClient, room: Room): RoomAdmin => {
  const myUserId = client.getUserId() ?? ""
  const listed = (memberships: string[]) =>
    room
      .getMembers()
      .filter(member => memberships.includes(member.membership ?? ""))
      .map(adminMember)
      .sort(byRank)

  return {
    room,
    name: room.name,
    topic: roomTopic(room),
    avatarUrl: roomAvatarUrl(room),
    myUserId,
    myLevel: memberLevel(room, myUserId),
    content: powerContent(room),
    members: listed(["join", "invite"]),
    banned: listed(["ban"]),
    canInvite: room.canInvite(myUserId),
    link: roomLink(client, room.roomId),
  }
}
