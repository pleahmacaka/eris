import {
  ClientEvent,
  EventTimeline,
  EventType,
  type HierarchyRoom,
  type MatrixClient,
  type Room,
  RoomEvent,
  RoomStateEvent,
  UserEvent,
} from "matrix-js-sdk"
import type { RoomMessageEventContent } from "matrix-js-sdk/lib/@types/events"
import {
  type MatrixRTCSession,
  MatrixRTCSessionEvent,
  MatrixRTCSessionManagerEvents,
} from "matrix-js-sdk/lib/matrixrtc"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { Message } from "#lib/i18n/translate.js"
import { attachmentContent, attachmentKind } from "#lib/matrix/attachments.js"
import {
  createChannel,
  createDmRoom,
  createServer,
  joinByAddress,
} from "#lib/matrix/create.js"
import {
  digestEvent,
  digestHierarchyRoom,
  digestMember,
  digestRoom,
  dmRoomIds,
  roomAvatarUrl,
  roomTopic,
  spaceChildLinks,
} from "#lib/matrix/digest.js"
import { errorCode, roomError, uploadError } from "#lib/matrix/errors.js"
import { collectFriends, type FriendDigest } from "#lib/matrix/friends.js"
import { groupMembers, type MemberDigest } from "#lib/matrix/members.js"
import {
  type MentionPick,
  type MentionSpan,
  messageContent,
  type RoomTarget,
} from "#lib/matrix/mentions.js"
import {
  invitedRooms,
  joinedRooms,
  type RoomDigest,
  serverName,
} from "#lib/matrix/rooms.js"
import {
  type ChannelKind,
  orphanRooms,
  type RoomAddress,
  type SpaceChildLink,
  spaceBadge,
  splitChannels,
} from "#lib/matrix/spaces.js"
import {
  type ChatItem,
  groupMessages,
  type MessageItem,
  type NoticeItem,
  toTimelineItem,
  withDaySeparators,
} from "#lib/matrix/timeline.js"
import { measureImage } from "#lib/media/image.js"
import { channelsPath } from "#lib/routes.js"
import { mediaStore } from "#lib/store/media.svelte.js"

const PAGE_SIZE = 30

export type SpaceDigest = {
  id: string
  name: string
  avatarUrl: string | null
  unread: number
  highlight: number
}

export type JoinedRoom = { id: string; isSpace: boolean }

export type SpaceChannel = { space: SpaceDigest; room: RoomDigest }

const present = <T>(value: T | null): value is T => value !== null

class ChatStore {
  spaces = $state.raw<SpaceDigest[]>([])
  channels = $state.raw<RoomDigest[]>([])
  joinedChannels = $state.raw<SpaceChannel[]>([])
  dms = $state.raw<RoomDigest[]>([])
  friends = $state.raw<FriendDigest[]>([])
  invites = $state.raw<RoomDigest[]>([])
  members = $state.raw<MemberDigest[]>([])
  selected = $state.raw<RoomDigest | null>(null)
  selectedSpaceId = $state<string | null>(null)
  selectedRoomId = $state<string | null>(null)
  items = $state.raw<ChatItem[]>([])
  canPaginate = $state(false)
  paginating = $state(false)
  loadingRoom = $state(false)
  error = $state<Message | null>(null)
  canMentionRoom = $state(false)

  selectedSpace = $derived(
    this.spaces.find(space => space.id === this.selectedSpaceId) ?? null,
  )
  textChannels = $derived(splitChannels(this.channels).text)
  voiceChannels = $derived(splitChannels(this.channels).voice)
  memberGroups = $derived(groupMembers(this.members))

  private client: MatrixClient | null = null
  private refreshQueued = false
  private readReceiptSentFor: string | null = null
  private watchedSessions = new WeakSet<MatrixRTCSession>()
  private hierarchy = new Map<string, Map<string, HierarchyRoom>>()
  private release: (() => void) | null = null

  attach(client: MatrixClient) {
    this.client = client

    const queue = () => this.queueRefresh()
    const onSession = (_roomId: string, session: MatrixRTCSession) => {
      this.watchSession(session)
      queue()
    }

    client.on(ClientEvent.Room, queue)
    client.on(UserEvent.Presence, queue)
    client.on(ClientEvent.DeleteRoom, queue)
    client.on(ClientEvent.AccountData, queue)
    client.on(ClientEvent.Sync, queue)
    client.on(RoomEvent.Timeline, queue)
    client.on(RoomEvent.LocalEchoUpdated, queue)
    client.on(RoomEvent.Name, queue)
    client.on(RoomEvent.MyMembership, queue)
    client.on(RoomEvent.Receipt, queue)
    client.on(RoomStateEvent.Members, queue)
    client.on(RoomStateEvent.Events, queue)
    client.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionStarted, onSession)
    client.matrixRTC.on(MatrixRTCSessionManagerEvents.SessionEnded, onSession)

    this.release = () => {
      client.off(ClientEvent.Room, queue)
      client.off(UserEvent.Presence, queue)
      client.off(ClientEvent.DeleteRoom, queue)
      client.off(ClientEvent.AccountData, queue)
      client.off(ClientEvent.Sync, queue)
      client.off(RoomEvent.Timeline, queue)
      client.off(RoomEvent.LocalEchoUpdated, queue)
      client.off(RoomEvent.Name, queue)
      client.off(RoomEvent.MyMembership, queue)
      client.off(RoomEvent.Receipt, queue)
      client.off(RoomStateEvent.Members, queue)
      client.off(RoomStateEvent.Events, queue)
      client.matrixRTC.off(
        MatrixRTCSessionManagerEvents.SessionStarted,
        onSession,
      )
      client.matrixRTC.off(
        MatrixRTCSessionManagerEvents.SessionEnded,
        onSession,
      )
    }

    this.refreshLists()
  }

  detach() {
    this.release?.()
    this.release = null
    this.client = null
    this.hierarchy.clear()
    this.spaces = []
    this.channels = []
    this.joinedChannels = []
    this.dms = []
    this.friends = []
    this.invites = []
    this.members = []
    this.selected = null
    this.selectedSpaceId = null
    this.selectedRoomId = null
    this.items = []
    this.canPaginate = false
    this.error = null
  }

  currentRoom(): Room | null {
    return this.selectedRoomId
      ? (this.client?.getRoom(this.selectedRoomId) ?? null)
      : null
  }

  roomById(roomId: string): Room | null {
    return this.client?.getRoom(roomId) ?? null
  }

  async selectSpace(spaceId: string | null) {
    this.selectedSpaceId = spaceId
    this.error = null
    this.refreshLists()

    if (spaceId && !this.hierarchy.has(spaceId)) {
      await this.loadHierarchy(spaceId)
    }
  }

  async select(roomId: string | null) {
    this.selectedRoomId = roomId
    this.error = null
    this.refreshLists()
    this.refreshTimeline()

    const room = this.currentRoom()

    if (!room) {
      return
    }

    void this.loadMembers(room)
    this.loadingRoom = true

    try {
      if (
        room.getLiveTimeline().getEvents().length < PAGE_SIZE &&
        this.canPaginate
      ) {
        await this.paginate()
      }

      await this.markRead(room)
    } finally {
      this.loadingRoom = false
    }
  }

  async joinChannel(channel: RoomDigest) {
    const client = this.client

    if (!client) {
      return
    }

    await client.joinRoom(channel.id, { viaServers: channel.via })

    if (this.selectedSpaceId) {
      this.hierarchy.delete(this.selectedSpaceId)
    }

    this.queueRefresh()
  }

  async paginate() {
    const room = this.currentRoom()
    const client = this.client

    if (!room || !client || this.paginating || !this.canPaginate) {
      return
    }

    this.paginating = true

    try {
      await client.scrollback(room, PAGE_SIZE)
      this.refreshTimeline()
    } catch (error) {
      this.error = roomError(errorCode(error))
    } finally {
      this.paginating = false
    }
  }

  async send(text: string, mentions: MentionSpan[]) {
    const client = this.client
    const roomId = this.selectedRoomId

    if (!client || !roomId) {
      return false
    }

    try {
      await client.sendMessage(
        roomId,
        messageContent(text, mentions) as RoomMessageEventContent,
      )
      this.error = null

      return true
    } catch (error) {
      this.error = {
        key:
          errorCode(error) === "M_FORBIDDEN"
            ? "chat.send.forbidden"
            : "chat.send.failed",
      }

      return false
    }
  }

  mentionableRooms() {
    const client = this.client

    if (!client) {
      return []
    }

    const dms = dmRoomIds(client)
    const here = new Set(this.channels.map(channel => channel.id))

    return client
      .getRooms()
      .filter(
        room =>
          room.getMyMembership() === "join" &&
          !room.isSpaceRoom() &&
          !dms.has(room.roomId),
      )
      .map(room => ({
        id: room.roomId,
        name: room.name,
        topic: roomTopic(room),
      }))
      .sort((a, b) => Number(here.has(b.id)) - Number(here.has(a.id)))
  }

  roomMention(roomId: string): MentionPick | null {
    const room = this.client?.getRoom(roomId)

    if (!room) {
      return null
    }

    const alias = room.getCanonicalAlias()
    const server = serverName(roomId) || this.client?.getDomain()

    return {
      label: `#${alias ? alias.slice(1, alias.indexOf(":")) : room.name}`,
      target: { kind: "room", roomId, alias, via: server ? [server] : [] },
    }
  }

  roomPath(target: RoomTarget) {
    const rooms = this.client?.getRooms() ?? []
    const room = rooms.find(
      candidate =>
        candidate.roomId === target.roomId ||
        (target.alias !== null &&
          (candidate.getCanonicalAlias() === target.alias ||
            candidate.getAltAliases().includes(target.alias))),
    )

    if (room?.getMyMembership() !== "join") {
      return null
    }

    const space = rooms.find(
      candidate =>
        candidate.isSpaceRoom() &&
        candidate.getMyMembership() === "join" &&
        spaceChildLinks(candidate).some(link => link.roomId === room.roomId),
    )

    return channelsPath({ spaceId: space?.roomId ?? null, roomId: room.roomId })
  }

  async sendFile(file: File, onProgress: (fraction: number) => void) {
    const client = this.client
    const roomId = this.selectedRoomId

    if (!client || !roomId) {
      return false
    }

    try {
      const url = await mediaStore.upload(file, onProgress)
      const dimensions =
        attachmentKind(file.type) === "image" ? await measureImage(file) : null

      await client.sendMessage(
        roomId,
        attachmentContent(file, url, dimensions) as RoomMessageEventContent,
      )
      this.error = null

      return true
    } catch (error) {
      this.error = uploadError(errorCode(error))

      return false
    }
  }

  async createServer(name: string, icon: File | null) {
    const client = this.client

    if (!client) {
      return null
    }

    const roomId = await createServer(client, name, icon, i18n.t)

    this.queueRefresh()

    return roomId
  }

  async joinSpace(address: RoomAddress): Promise<JoinedRoom | null> {
    const client = this.client

    if (!client) {
      return null
    }

    const room = await joinByAddress(client, address)

    this.queueRefresh()

    return { id: room.roomId, isSpace: room.isSpaceRoom() }
  }

  async createChannel(name: string, kind: ChannelKind) {
    const client = this.client
    const spaceId = this.selectedSpaceId

    if (!client || !spaceId) {
      return null
    }

    const roomId = await createChannel(client, spaceId, name, kind)

    this.hierarchy.delete(spaceId)
    this.queueRefresh()

    return roomId
  }

  async startDm(userIds: string[]) {
    const client = this.client

    if (!client) {
      return null
    }

    const direct = client.getAccountData(EventType.Direct)?.getContent() ?? {}
    const knownFor = (userId: string) =>
      (direct[userId] as string[] | undefined) ?? []

    if (userIds.length === 1) {
      const existing = knownFor(userIds[0]).find(id => {
        const room = client.getRoom(id)

        return (
          room?.getMyMembership() === "join" &&
          room.getInvitedAndJoinedMemberCount() <= 2
        )
      })

      if (existing) {
        return existing
      }
    }

    const { room_id } = await createDmRoom(client, userIds)

    await client.setAccountData(EventType.Direct, {
      ...direct,
      ...Object.fromEntries(
        userIds.map(userId => [userId, [...knownFor(userId), room_id]]),
      ),
    })
    this.queueRefresh()

    return room_id
  }

  async acceptInvite(invite: RoomDigest): Promise<JoinedRoom | null> {
    const client = this.client

    if (!client) {
      return null
    }

    const room = await client.joinRoom(invite.id)

    this.queueRefresh()

    return { id: room.roomId, isSpace: room.isSpaceRoom() }
  }

  async declineInvite(invite: RoomDigest) {
    await this.client?.leave(invite.id)
    this.queueRefresh()
  }

  private async loadHierarchy(spaceId: string) {
    const client = this.client

    if (!client) {
      return
    }

    try {
      const { rooms } = await client.getRoomHierarchy(spaceId, 100, 1)

      this.hierarchy.set(
        spaceId,
        new Map(rooms.map(room => [room.room_id, room])),
      )
      this.refreshLists()
    } catch (error) {
      this.error = roomError(errorCode(error))
    }
  }

  private async loadMembers(room: Room) {
    try {
      await room.loadMembersIfNeeded()
    } catch (error) {
      this.error = roomError(errorCode(error))
    }
  }

  private watchSession(session: MatrixRTCSession) {
    if (this.watchedSessions.has(session)) {
      return
    }

    this.watchedSessions.add(session)
    session.on(MatrixRTCSessionEvent.MembershipsChanged, () =>
      this.queueRefresh(),
    )
  }

  private queueRefresh() {
    if (this.refreshQueued) {
      return
    }

    this.refreshQueued = true
    queueMicrotask(() => {
      this.refreshQueued = false

      if (this.client) {
        this.refreshLists()
        this.refreshTimeline()
      }
    })
  }

  private refreshLists() {
    const client = this.client

    if (!client) {
      return
    }

    const dms = dmRoomIds(client)
    const all = client
      .getRooms()
      .filter(room => ["join", "invite"].includes(room.getMyMembership()))
    const spaces = all.filter(
      room => room.isSpaceRoom() && room.getMyMembership() === "join",
    )
    const links = new Map(
      spaces.map(space => [space.roomId, spaceChildLinks(space)]),
    )
    const childIds = new Set(
      [...links.values()].flat().map(link => link.roomId),
    )
    const digest = (room: Room, link?: SpaceChildLink) => {
      if (room.getMyMembership() === "join") {
        this.watchSession(client.matrixRTC.getRoomSession(room))
      }

      return digestRoom(client, room, dms, link)
    }
    const listedChild = (
      link: SpaceChildLink,
      hierarchy?: Map<string, HierarchyRoom>,
    ) => {
      const room = client.getRoom(link.roomId)

      if (room && ["join", "invite"].includes(room.getMyMembership())) {
        return digest(room, link)
      }

      const info = hierarchy?.get(link.roomId)

      return info ? digestHierarchyRoom(info, link) : null
    }

    const children = new Map(
      spaces.map(space => [
        space.roomId,
        (links.get(space.roomId) ?? [])
          .map(link => listedChild(link))
          .filter(present),
      ]),
    )

    this.spaces = spaces.map(space => ({
      id: space.roomId,
      name: space.name,
      avatarUrl: roomAvatarUrl(space),
      ...spaceBadge(children.get(space.roomId) ?? []),
    }))
    this.joinedChannels = this.spaces.flatMap(space =>
      (children.get(space.id) ?? [])
        .filter(room => room.membership === "join")
        .map(room => ({ space, room })),
    )

    const plain = all.filter(room => !room.isSpaceRoom())

    this.invites = invitedRooms(all.map(room => digest(room)))
    this.friends = collectFriends(client, all, dms)
    this.dms = joinedRooms([
      ...plain.filter(room => dms.has(room.roomId)).map(room => digest(room)),
      ...orphanRooms(
        plain.filter(room => !dms.has(room.roomId)).map(room => digest(room)),
        childIds,
      ),
    ])

    const spaceId = this.selectedSpaceId

    this.channels = spaceId
      ? (links.get(spaceId) ?? [])
          .map(link => listedChild(link, this.hierarchy.get(spaceId)))
          .filter(present)
      : []

    const current = this.currentRoom()
    const currentLink = current
      ? [...links.values()].flat().find(link => link.roomId === current.roomId)
      : undefined

    this.selected = current ? digest(current, currentLink) : null
    this.members = current
      ? current.getJoinedMembers().map(member => digestMember(client, member))
      : []
    this.canMentionRoom =
      current?.currentState.mayTriggerNotifOfType(
        "room",
        client.getUserId() ?? "",
      ) ?? false
  }

  private refreshTimeline() {
    const client = this.client
    const room = this.currentRoom()

    if (!client || !room) {
      this.items = []
      this.canPaginate = false

      return
    }

    const myUserId = client.getUserId() ?? ""
    const timeline = room.getLiveTimeline()
    const visible = timeline
      .getEvents()
      .map(event => toTimelineItem(digestEvent(room, event), myUserId))
      .filter((item): item is MessageItem | NoticeItem => item !== null)

    this.items = groupMessages(withDaySeparators(visible))
    this.canPaginate =
      timeline.getPaginationToken(EventTimeline.BACKWARDS) !== null
    void this.markRead(room)
  }

  private async markRead(room: Room) {
    const client = this.client
    const events = room.getLiveTimeline().getEvents()
    const last = events[events.length - 1]
    const lastId = last?.getId()

    if (
      !client ||
      !last ||
      lastId === undefined ||
      lastId === this.readReceiptSentFor
    ) {
      return
    }

    if (
      room.getUnreadNotificationCount() > 0 ||
      last.getSender() !== client.getUserId()
    ) {
      // the local-echo receipt re-emits RoomEvent.Receipt synchronously, which would re-queue this refresh forever
      this.readReceiptSentFor = lastId
      await client.sendReadReceipt(last).catch(() => undefined)
    }
  }
}

export const chatStore = new ChatStore()
