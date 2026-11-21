<script lang="ts">
import Icon from "@iconify/svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { canPlaceVoiceCall } from "#lib/matrix/calls.js"
import { canManage } from "#lib/matrix/power.js"
import { memberLevel, powerContent } from "#lib/matrix/roomActions.js"
import type { RoomDigest } from "#lib/matrix/rooms.js"
import { channelsPath } from "#lib/routes.js"
import { callStore } from "#lib/store/call.svelte.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"
import { layoutStore } from "#lib/store/layout.svelte.js"
import { profileCardStore } from "#lib/store/profileCard.svelte.js"
import { promptStore } from "#lib/store/prompt.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { goto } from "$app/navigation"

let { room }: { room: RoomDigest } = $props()

const client = $derived(sessionStore.client)
const kind = $derived(chatStore.selectedSpaceId === null ? "room" : "channel")
const manageable = $derived.by(() => {
  const target = chatStore.roomById(room.id)

  return (
    !room.isDm &&
    client !== null &&
    target !== null &&
    canManage(
      powerContent(target),
      memberLevel(target, client.getUserId() ?? ""),
    )
  )
})
const voiceAllowed = $derived(
  room.isDm &&
    client !== null &&
    canPlaceVoiceCall(room.joinedCount, client.supportsVoip()),
)
const busy = $derived(callStore.active || groupCallStore.active)
const icon = $derived(room.kind === "voice" ? "lucide:volume-2" : "lucide:hash")
const peer = $derived(
  room.isDm
    ? chatStore.roomById(room.id)?.getAvatarFallbackMember()
    : undefined,
)

const peerName = () => {
  const other = client
    ?.getRoom(room.id)
    ?.getJoinedMembers()
    .find(member => member.userId !== client.getUserId())

  return other?.name ?? room.name
}

const startVoice = () => {
  if (client) {
    callStore.place(client, room.id, peerName())
  }
}

const back = () =>
  goto(channelsPath({ spaceId: chatStore.selectedSpaceId, roomId: null }))
</script>

<header
  class="flex h-12 shrink-0 items-center gap-2 border-base-content/10 border-b px-3"
>
  <button
    type="button"
    class="btn btn-ghost btn-square btn-sm md:hidden"
    aria-label={i18n.t("ui.back")}
    title={i18n.t("ui.back")}
    onclick={back}
  >
    <Icon icon="lucide:arrow-left" class="size-5 rtl:-scale-x-100" />
  </button>

  {#if !room.isDm}
    <Icon {icon} class="size-5 shrink-0 text-subtle" />
  {/if}

  <div class="flex min-w-0 flex-1 items-center gap-3">
    <h1 class="min-w-0 truncate font-semibold" title={room.name}>
      {#if room.isDm}
        <button
          type="button"
          class="flex max-w-full cursor-pointer items-center gap-2"
          disabled={!peer}
          onclick={event =>
            peer && profileCardStore.open(peer.userId, event.currentTarget)}
        >
          <Avatar name={room.name} mxc={room.avatarUrl} size="xs" tone="primary" />
          <span class="truncate">{room.name}</span>
        </button>
      {:else}
        {room.name}
      {/if}
    </h1>
    {#if room.topic !== ""}
      <span class="hidden min-w-0 truncate text-muted text-sm sm:inline" title={room.topic}>
        {room.topic}
      </span>
    {/if}
  </div>

  {#if voiceAllowed}
    <button
      type="button"
      class="btn btn-ghost btn-square btn-sm"
      aria-label={i18n.t("call.voiceCall")}
      title={i18n.t("call.voiceCall")}
      disabled={busy}
      onclick={startVoice}
    >
      <Icon icon="lucide:phone" class="size-5" />
    </button>
  {/if}

  {#if manageable}
    <button
      type="button"
      class="btn btn-ghost btn-square btn-sm"
      aria-label={i18n.t("menu.room.settings", { kind })}
      title={i18n.t("menu.room.settings", { kind })}
      onclick={() => {
        promptStore.configuring = { roomId: room.id, name: room.name, kind }
      }}
    >
      <Icon icon="lucide:settings" class="size-5" />
    </button>
  {/if}

  <button
    type="button"
    class="btn btn-ghost btn-square btn-sm"
    aria-label={i18n.t("chat.members.list")}
    title={i18n.t("chat.members.list")}
    aria-pressed={layoutStore.narrow ? layoutStore.membersSheet : layoutStore.membersOpen}
    onclick={() => layoutStore.toggleMembers()}
  >
    <Icon icon="lucide:users" class="size-5" />
  </button>
</header>
