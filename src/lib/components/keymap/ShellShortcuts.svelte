<script lang="ts">
import { type Step, walk } from "#lib/keymap/navigate.js"
import { actionError, errorCode } from "#lib/matrix/errors.js"
import { markRoomsRead } from "#lib/matrix/roomActions.js"
import type { RoomDigest } from "#lib/matrix/rooms.js"
import { channelsPath, homeViewPath } from "#lib/routes.js"
import { visit } from "#lib/shell/visit.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { keymapStore } from "#lib/store/keymap.svelte.js"
import { layoutStore } from "#lib/store/layout.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"

const rooms = $derived(
  (chatStore.selectedSpaceId === null
    ? chatStore.dms
    : [...chatStore.textChannels, ...chatStore.voiceChannels]
  ).filter(room => room.membership === "join"),
)

const ahead = (step: Step) =>
  walk(
    rooms,
    rooms.findIndex(room => room.id === chatStore.selectedRoomId),
    step,
  )

const openRoom = (room: RoomDigest | undefined) => {
  if (room) {
    visit(channelsPath({ spaceId: chatStore.selectedSpaceId, roomId: room.id }))
  }
}

const openSpace = (step: Step) => {
  const spaceIds = [null, ...chatStore.spaces.map(space => space.id)]
  const next = walk(spaceIds, spaceIds.indexOf(chatStore.selectedSpaceId), step)

  if (next.length > 0) {
    visit(channelsPath({ spaceId: next[0], roomId: null }))
  }
}

const markRead = (roomIds: string[]) => {
  const client = sessionStore.client

  if (client) {
    void markRoomsRead(client, roomIds).catch((cause: unknown) => {
      chatStore.error = actionError(errorCode(cause))
    })
  }
}

$effect(() =>
  keymapStore.handle({
    previousChannel: () => openRoom(ahead(-1)[0]),
    nextChannel: () => openRoom(ahead(1)[0]),
    previousUnread: () => openRoom(ahead(-1).find(room => room.unread > 0)),
    nextUnread: () => openRoom(ahead(1).find(room => room.unread > 0)),
    previousSpace: () => openSpace(-1),
    nextSpace: () => openSpace(1),
    openFriends: () => visit(homeViewPath("friends")),
    markSpaceRead: () => markRead(rooms.map(room => room.id)),
  }),
)

$effect(() => {
  const roomId = chatStore.selected?.id

  if (roomId !== undefined) {
    return keymapStore.handle({
      markChannelRead: () => markRead([roomId]),
      toggleMembers: () => layoutStore.toggleMembers(),
    })
  }
})
</script>
