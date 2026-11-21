<script lang="ts">
import Icon from "@iconify/svelte"
import { fly, slide } from "svelte/transition"
import { contextMenu, menuButton } from "#lib/attachments/contextMenu.js"
import ChannelRow from "#lib/components/channels/ChannelRow.svelte"
import CreateChannelDialog from "#lib/components/channels/CreateChannelDialog.svelte"
import DmRow from "#lib/components/channels/DmRow.svelte"
import UserPanel from "#lib/components/channels/UserPanel.svelte"
import VoiceStatus from "#lib/components/channels/VoiceStatus.svelte"
import InviteRow from "#lib/components/rooms/InviteRow.svelte"
import StartDmDialog from "#lib/components/rooms/StartDmDialog.svelte"
import type { MessageKey } from "#lib/i18n/catalogs.js"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { RoomDigest } from "#lib/matrix/rooms.js"
import type { ChannelKind } from "#lib/matrix/spaces.js"
import { spaceSections } from "#lib/menu/actions.js"
import { duration, QUICK_MS, softEnter } from "#lib/motion/durations.js"
import {
  channelsPath,
  type HomeView,
  homeViewPath,
  parseChannelsPath,
  parseHomeView,
} from "#lib/routes.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"
import { keymapStore } from "#lib/store/keymap.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { goto } from "$app/navigation"
import { page } from "$app/state"

let creatingKind = $state<ChannelKind | null>(null)
let messaging = $state(false)

$effect(() =>
  keymapStore.handle({
    startDm: () => {
      messaging = true
    },
  }),
)

const spaceId = $derived(chatStore.selectedSpaceId)
const title = $derived(chatStore.selectedSpace?.name ?? i18n.t("channels.home"))

const serverMenu = () =>
  chatStore.selectedSpace ? spaceSections(chatStore.selectedSpace) : []

const open = async (room: RoomDigest) => {
  if (room.membership === "none") {
    await chatStore.joinChannel(room)
  }

  await goto(channelsPath({ spaceId, roomId: room.id }))

  if (room.kind === "voice" && room.membership !== "none") {
    const client = sessionStore.client
    const target = chatStore.roomById(room.id)

    if (
      client &&
      target &&
      groupCallStore.roomId !== room.id &&
      groupCallStore.support !== "unavailable"
    ) {
      void groupCallStore.join(client, target)
    }
  }
}

const activeRoomId = $derived(
  parseChannelsPath(page.url.pathname)?.roomId ?? null,
)
const activeView = $derived(parseHomeView(page.url.pathname))
const friendRequests = $derived(
  chatStore.friends.filter(friend => friend.state === "incoming").length,
)

const HOME_LINKS: { view: HomeView; label: MessageKey; icon: string }[] = [
  { view: "friends", label: "channels.friends", icon: "lucide:users" },
  { view: "home", label: "channels.home", icon: "lucide:house" },
]
</script>

<aside
  class="panel-surface flex min-w-0 flex-1 flex-col border-base-content/10 border-e"
>
  <header
    class="flex h-12 shrink-0 items-center border-base-content/10 border-b px-4 font-bold"
  >
    {#if spaceId === null}
      <span class="truncate" title={title}>{title}</span>
    {:else}
      <button
        type="button"
        class="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 text-start"
        aria-haspopup="menu"
        {@attach menuButton(serverMenu)}
        {@attach contextMenu(serverMenu)}
      >
        <span class="min-w-0 flex-1 truncate" title={title}>{title}</span>
        <Icon icon="lucide:chevron-down" class="size-4 shrink-0 text-muted" />
      </button>
    {/if}
  </header>

  <div class="grid min-h-0 flex-1">
    {#key spaceId}
      <nav
        class="col-start-1 row-start-1 min-h-0 overflow-y-auto px-2 py-3"
        aria-label={i18n.t(spaceId ? "channels.list.channels" : "channels.list.conversations")}
        in:fly={softEnter()}
      >
        {#if spaceId === null}
          <ul class="mb-3 flex flex-col gap-0.5">
            {#each HOME_LINKS as link (link.view)}
              <li>
                <a
                  href={homeViewPath(link.view)}
                  class={[
                    "flex items-center gap-3 rounded-field px-2 py-2 font-medium",
                    activeView === link.view
                      ? "bg-base-content/10 text-base-content"
                      : "text-muted hover:bg-base-content/5 hover:text-base-content",
                  ]}
                  aria-current={activeView === link.view ? "page" : undefined}
                >
                  <Icon icon={link.icon} class="size-5" />
                  <span class="min-w-0 flex-1 truncate">{i18n.t(link.label)}</span>
                  {#if link.view === "friends" && friendRequests > 0}
                    <span class="badge badge-error badge-xs tabular-nums">{friendRequests}</span>
                  {/if}
                </a>
              </li>
            {/each}
          </ul>

          <button
            type="button"
            class="btn btn-sm mb-3 w-full"
            onclick={() => {
              messaging = true
            }}
          >
            <Icon icon="lucide:message-square-plus" class="size-4" />
            {i18n.t("channels.dm.start")}
          </button>

          {#if chatStore.invites.length > 0}
            <p class="px-2 pt-2 pb-1 font-semibold text-subtle text-xs">{i18n.t("channels.invites")}</p>
            <ul class="flex flex-col gap-1">
              {#each chatStore.invites as invite (invite.id)}
                <li transition:slide={{ duration: duration(QUICK_MS) }}>
                  <InviteRow room={invite} />
                </li>
              {/each}
            </ul>
          {/if}

          <div class="flex items-center justify-between px-2 pt-3 pb-1">
            <p class="font-semibold text-subtle text-xs">{i18n.t("channels.dm.title")}</p>
            <button
              type="button"
              class="btn btn-ghost btn-square btn-xs"
              aria-label={i18n.t("channels.dm.start")}
              title={i18n.t("channels.dm.start")}
              onclick={() => {
                messaging = true
              }}
            >
              <Icon icon="lucide:plus" class="size-3.5" />
            </button>
          </div>
          {#if chatStore.dms.length === 0}
            <p class="px-2 py-2 text-subtle text-xs">{i18n.t("channels.dm.empty")}</p>
          {:else}
            <ul class="flex flex-col gap-0.5">
              {#each chatStore.dms as room (room.id)}
                <li>
                  <DmRow
                    {room}
                    selected={room.id === activeRoomId}
                    onselect={() => open(room)}
                  />
                </li>
              {/each}
            </ul>
          {/if}

        {:else}
          <div class="flex items-center justify-between px-2 pb-1">
            <p class="font-semibold text-subtle text-xs">{i18n.t("channels.text.title")}</p>
            <button
              type="button"
              class="btn btn-ghost btn-square btn-xs"
              aria-label={i18n.t("channels.text.create")}
              title={i18n.t("channels.text.create")}
              onclick={() => {
                creatingKind = "text"
              }}
            >
              <Icon icon="lucide:plus" class="size-3.5" />
            </button>
          </div>
          {#if chatStore.textChannels.length === 0}
            <p class="px-2 py-2 text-subtle text-xs">{i18n.t("channels.empty")}</p>
          {:else}
            <ul class="flex flex-col gap-0.5">
              {#each chatStore.textChannels as room (room.id)}
                <li>
                  <ChannelRow
                    {room}
                    selected={room.id === activeRoomId}
                    onselect={() => open(room)}
                  />
                </li>
              {/each}
            </ul>
          {/if}

          <div class="flex items-center justify-between px-2 pt-4 pb-1">
            <p class="font-semibold text-subtle text-xs">{i18n.t("voice.stage.label")}</p>
            <button
              type="button"
              class="btn btn-ghost btn-square btn-xs"
              aria-label={i18n.t("channels.voice.create")}
              title={i18n.t("channels.voice.create")}
              onclick={() => {
                creatingKind = "voice"
              }}
            >
              <Icon icon="lucide:plus" class="size-3.5" />
            </button>
          </div>
          {#if chatStore.voiceChannels.length === 0}
            <p class="px-2 py-2 text-subtle text-xs">{i18n.t("channels.empty")}</p>
          {:else}
            <ul class="flex flex-col gap-0.5">
              {#each chatStore.voiceChannels as room (room.id)}
                <li>
                  <ChannelRow
                    {room}
                    selected={room.id === activeRoomId}
                    onselect={() => open(room)}
                  />
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      </nav>
    {/key}
  </div>

  {#if groupCallStore.active}
    <div transition:slide={{ duration: duration(QUICK_MS) }}>
      <VoiceStatus />
    </div>
  {/if}

  <UserPanel />
</aside>

<CreateChannelDialog
  open={creatingKind !== null}
  kind={creatingKind ?? "text"}
  onclose={() => {
    creatingKind = null
  }}
/>
<StartDmDialog
  open={messaging}
  onclose={() => {
    messaging = false
  }}
/>
