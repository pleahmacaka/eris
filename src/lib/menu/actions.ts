import type { MatrixClient, Room } from "matrix-js-sdk"
import { mentionInComposer } from "#lib/attachments/composerField.js"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { actionError, errorCode } from "#lib/matrix/errors.js"
import {
  canChangeLevel,
  canManage,
  canModerate,
  canRedact,
} from "#lib/matrix/power.js"
import {
  dmPeerId,
  eventLink,
  markRoomsRead,
  memberLevel,
  powerContent,
  roomLink,
  spaceChildIds,
  standing,
} from "#lib/matrix/roomActions.js"
import type { RoomDigest } from "#lib/matrix/rooms.js"
import type { ChatMessage } from "#lib/matrix/timeline.js"
import { channelsPath, HOME_PATH } from "#lib/routes.js"
import { chatStore, type SpaceDigest } from "#lib/store/chat.svelte.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"
import { layoutStore } from "#lib/store/layout.svelte.js"
import { promptStore, type RoomTarget } from "#lib/store/prompt.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { goto } from "$app/navigation"
import type { MenuSection } from "./items"
import {
  dmMenu,
  homeMenu,
  messageMenu,
  type RoomKind,
  roomMenu,
  userMenu,
} from "./menus"

type LeaveKind = RoomKind | "dm"

const MODERATION = {
  kick: {
    label: "menu.user.kick",
    body: "menu.confirm.kick.body",
  },
  ban: {
    label: "menu.user.ban",
    body: "menu.confirm.ban.body",
  },
} satisfies Record<string, { label: MessageKey; body: MessageKey }>

const copyText = (text: string) => {
  void navigator.clipboard.writeText(text)
}

const guarded = (action: () => Promise<unknown>) => () => {
  void action().catch((cause: unknown) => {
    chatStore.error = actionError(errorCode(cause))
  })
}

const leaveView = async (roomId: string) => {
  if (chatStore.selectedSpaceId === roomId) {
    await goto(HOME_PATH)
  } else if (chatStore.selectedRoomId === roomId) {
    await goto(
      channelsPath({ spaceId: chatStore.selectedSpaceId, roomId: null }),
    )
  }
}

const confirmLeave = (target: RoomTarget, kind: LeaveKind) => {
  promptStore.confirming = {
    title:
      kind === "dm"
        ? { key: "menu.dm.leave" }
        : { key: "menu.room.leave", values: { kind } },
    body: {
      key: "menu.confirm.leave.body",
      values: { kind, name: target.name },
    },
    action: { key: "menu.confirm.leave.action" },
    run: async () => {
      if (groupCallStore.roomId === target.roomId) {
        await groupCallStore.leave()
      }

      await sessionStore.client?.leave(target.roomId)
      await leaveView(target.roomId)
    },
  }
}

export const confirmModeration = (
  action: keyof typeof MODERATION,
  room: Room,
  user: { userId: string; name: string },
) => {
  const { label, body } = MODERATION[action]

  promptStore.confirming = {
    title: { key: label },
    body: { key: body, values: { user: user.name, room: room.name } },
    action: { key: label },
    note: { key: "menu.confirm.reason" },
    run: async reason => {
      await sessionStore.client?.[action](
        room.roomId,
        user.userId,
        reason === "" ? undefined : reason,
      )
    },
  }
}

type RoomMenuTarget = RoomTarget & {
  kind: RoomKind
  voice: boolean
  joined: boolean
  unread: boolean
  via: string[]
  readIds: string[]
  open: () => void
}

const roomTargetMenu = (
  client: MatrixClient,
  target: RoomMenuTarget,
): MenuSection[] => {
  const me = client.getUserId() ?? ""
  const room = client.getRoom(target.roomId)
  const ref = { roomId: target.roomId, name: target.name }

  return roomMenu(
    {
      kind: target.kind,
      voice: target.voice,
      joined: target.joined,
      unread: target.unread,
      inCall: groupCallStore.roomId === target.roomId,
      callReady: groupCallStore.support === "available",
      canInvite: room?.canInvite(me) ?? false,
      canManage:
        room !== null && canManage(powerContent(room), memberLevel(room, me)),
    },
    {
      open: target.open,
      leaveCall: () => {
        void groupCallStore.leave()
      },
      markRead: guarded(() => markRoomsRead(client, target.readIds)),
      invite: () => {
        promptStore.inviting = ref
      },
      copyLink: () => copyText(roomLink(client, target.roomId, target.via)),
      settings: () => {
        promptStore.configuring = { ...ref, kind: target.kind }
      },
      leave: () => confirmLeave(ref, target.kind),
      copyId: () => copyText(target.roomId),
    },
  )
}

export const roomSections = (
  room: RoomDigest,
  kind: RoomKind,
  open: () => void,
): MenuSection[] => {
  const client = sessionStore.client

  return client
    ? roomTargetMenu(client, {
        roomId: room.id,
        name: room.name,
        kind,
        voice: room.kind === "voice",
        joined: room.membership === "join",
        unread: room.unread > 0,
        via: room.via,
        readIds: [room.id],
        open,
      })
    : []
}

export const spaceSections = (space: SpaceDigest): MenuSection[] => {
  const client = sessionStore.client

  return client
    ? roomTargetMenu(client, {
        roomId: space.id,
        name: space.name,
        kind: "server",
        voice: false,
        joined: true,
        unread: space.unread > 0,
        via: [],
        readIds: spaceChildIds(client, space.id),
        open: () => undefined,
      })
    : []
}

export const dmSections = (
  room: RoomDigest,
  open: () => void,
): MenuSection[] => {
  const client = sessionStore.client

  if (!client) {
    return []
  }

  if (!room.isDm) {
    return roomSections(room, "room", open)
  }

  const peer = dmPeerId(client, room.id)

  return dmMenu(
    { unread: room.unread > 0, peer: peer !== null },
    {
      markRead: guarded(() => markRoomsRead(client, [room.id])),
      leave: () => confirmLeave({ roomId: room.id, name: room.name }, "dm"),
      copyUserId: () => copyText(peer ?? ""),
    },
  )
}

export const homeSections = (): MenuSection[] => {
  const client = sessionStore.client
  const roomIds = chatStore.dms.map(room => room.id)

  return client
    ? homeMenu(
        chatStore.dms.some(room => room.unread > 0),
        guarded(() => markRoomsRead(client, roomIds)),
      )
    : []
}

export const messageSections = (item: ChatMessage): MenuSection[] => {
  const client = sessionStore.client
  const room = chatStore.currentRoom()

  if (!client || !room) {
    return []
  }

  const myLevel = memberLevel(room, client.getUserId() ?? "")

  return messageMenu(
    {
      pending: item.pending,
      removable: item.mine || canRedact(powerContent(room), myLevel),
    },
    {
      copyText: () => copyText(item.body),
      copyLink: () => copyText(eventLink(client, room.roomId, item.id)),
      remove: () => {
        promptStore.confirming = {
          title: { key: "menu.message.delete" },
          body: { key: "menu.confirm.deleteMessage.body" },
          action: { key: "menu.confirm.deleteMessage.action" },
          run: async () => {
            await client.redactEvent(room.roomId, item.id)
          },
        }
      },
      copyId: () => copyText(item.id),
    },
  )
}

const messageUser = async (userId: string) => {
  const roomId = await chatStore.startDm([userId])

  layoutStore.membersSheet = false

  if (roomId) {
    await goto(channelsPath({ spaceId: null, roomId }))
  }
}

export const userSections = (
  user: { userId: string; name: string },
  mention: boolean,
): MenuSection[] => {
  const client = sessionStore.client
  const room = chatStore.currentRoom()

  if (!client || !room) {
    return []
  }

  const content = powerContent(room)
  const rank = standing(room, client.getUserId() ?? "", user.userId)
  const membership = room.getMember(user.userId)?.membership

  return userMenu(
    {
      self: rank.self,
      mention,
      role: canChangeLevel(content, rank),
      kick:
        (membership === "join" || membership === "invite") &&
        canModerate(content, "kick", rank),
      ban: membership !== "ban" && canModerate(content, "ban", rank),
    },
    {
      message: guarded(() => messageUser(user.userId)),
      mention: () => {
        layoutStore.membersSheet = false
        mentionInComposer(user.userId)
      },
      changeRole: () => {
        promptStore.assigning = {
          roomId: room.roomId,
          name: room.name,
          userId: user.userId,
          userName: user.name,
        }
      },
      kick: () => confirmModeration("kick", room, user),
      ban: () => confirmModeration("ban", room, user),
      copyId: () => copyText(user.userId),
    },
  )
}
