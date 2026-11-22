import type { MatrixClient, Room } from "matrix-js-sdk"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { memberAvatarUrl } from "./digest"
import { isOnline, type Presence } from "./members"

export type FriendState = "friend" | "incoming" | "outgoing"

export type FriendDigest = {
  userId: string
  name: string
  avatarUrl: string | null
  presence: Presence
  roomId: string
  state: FriendState
}

export type FriendTab = "online" | "all" | "pending"

export const FRIEND_TAB_LABEL: Record<FriendTab, MessageKey> = {
  online: "friends.tab.online",
  all: "friends.tab.all",
  pending: "friends.tab.pending",
}

export const PRESENCE_LABEL = (presence: Presence): MessageKey =>
  presence === "online"
    ? "presence.online"
    : presence === "unavailable"
      ? "presence.unavailable"
      : "presence.offline"

const inTab = (friend: FriendDigest, tab: FriendTab) => {
  if (tab === "pending") {
    return friend.state !== "friend"
  }

  return (
    friend.state === "friend" && (tab === "all" || isOnline(friend.presence))
  )
}

const matches = (friend: FriendDigest, query: string) => {
  const needle = query.trim().toLowerCase()

  return (
    needle === "" ||
    friend.name.toLowerCase().includes(needle) ||
    friend.userId.toLowerCase().includes(needle)
  )
}

const STATE_ORDER: Record<FriendState, number> = {
  incoming: 0,
  outgoing: 1,
  friend: 2,
}

export const friendsForTab = (
  friends: FriendDigest[],
  tab: FriendTab,
  query: string,
) =>
  friends
    .filter(friend => inTab(friend, tab) && matches(friend, query))
    .sort(
      (a, b) =>
        STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
        Number(isOnline(b.presence)) - Number(isOnline(a.presence)) ||
        a.name.localeCompare(b.name, "ko"),
    )

const directInviter = (room: Room, myUserId: string) => {
  const event = room.getMember(myUserId)?.events.member

  return event?.getContent().is_direct === true ? event.getSender() : undefined
}

const describe = (
  client: MatrixClient,
  room: Room,
  userId: string,
  state: FriendState,
): FriendDigest => ({
  userId,
  name:
    room.getMember(userId)?.name ??
    client.getUser(userId)?.displayName ??
    userId,
  avatarUrl:
    memberAvatarUrl(room.getMember(userId)) ??
    client.getUser(userId)?.avatarUrl ??
    null,
  presence: client.getUser(userId)?.presence as Presence,
  roomId: room.roomId,
  state,
})

export const collectFriends = (
  client: MatrixClient,
  rooms: Room[],
  dms: Set<string>,
): FriendDigest[] => {
  const myUserId = client.getUserId() ?? ""
  const byUser = new Map<string, FriendDigest>()

  for (const room of rooms) {
    if (room.getMyMembership() === "invite") {
      const inviter = directInviter(room, myUserId)

      if (inviter && !byUser.has(inviter)) {
        byUser.set(inviter, describe(client, room, inviter, "incoming"))
      }

      continue
    }

    if (
      room.getMyMembership() !== "join" ||
      !dms.has(room.roomId) ||
      room.getInvitedAndJoinedMemberCount() !== 2
    ) {
      continue
    }

    const userId = room.guessDMUserId()

    if (userId === myUserId) {
      continue
    }

    const state =
      room.getMember(userId)?.membership === "invite" ? "outgoing" : "friend"

    if (byUser.get(userId)?.state !== "friend") {
      byUser.set(userId, describe(client, room, userId, state))
    }
  }

  return [...byUser.values()]
}
