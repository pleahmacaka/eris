<script lang="ts">
import Icon from "@iconify/svelte"
import { scale } from "svelte/transition"
import { contextMenu } from "#lib/attachments/contextMenu.js"
import AudioToggle from "#lib/components/call/AudioToggle.svelte"
import Backdrop from "#lib/components/chat/Backdrop.svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { GROUP_CALL_UNSUPPORTED } from "#lib/matrix/errors.js"
import type { RoomDigest } from "#lib/matrix/rooms.js"
import { userSections } from "#lib/menu/actions.js"
import { duration, QUICK_MS } from "#lib/motion/durations.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"
import { profileCardStore } from "#lib/store/profileCard.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"

let { room }: { room: RoomDigest } = $props()

const joined = $derived(groupCallStore.roomId === room.id)
const connected = $derived(joined && groupCallStore.phase === "connected")
const tiles = $derived(
  joined
    ? groupCallStore.participants
    : room.callMembers.map(member => ({
        key: `${member.userId}:${member.deviceId}`,
        userId: member.userId,
        name: member.name,
        avatarUrl: member.avatarUrl,
        me: false,
        connected: true,
        speaking: false,
        muted: false,
      })),
)

const join = () => {
  const client = sessionStore.client
  const target = chatStore.roomById(room.id)

  if (client && target) {
    void groupCallStore.join(client, target)
  }
}
</script>

<section
  class="relative isolate flex shrink-0 flex-col gap-4 overflow-hidden border-base-content/10 border-b px-4 py-5"
  aria-label={i18n.t("voice.stage.label")}
>
  <Backdrop strength="faint" />

  <div class="flex items-center gap-3">
    <Icon icon="lucide:volume-2" class="size-5 text-muted" />
    <p class="font-bold">{room.name}</p>
    <p class="text-muted text-sm">
      {i18n.t(
        joined
          ? groupCallStore.label
          : tiles.length > 0
            ? "voice.stage.inProgress"
            : "voice.phase.idle",
      )}
    </p>
  </div>

  {#if groupCallStore.error && groupCallStore.errorRoomId === room.id}
    <p class="text-error text-sm" role="alert">{i18n.text(groupCallStore.error)}</p>
  {/if}

  {#if tiles.length > 0}
    <ul class="flex flex-wrap gap-3" aria-label={i18n.t("voice.stage.participants")}>
      {#each tiles as tile (tile.key)}
        <li transition:scale={{ start: 0.9, duration: duration(QUICK_MS) }}>
          <button
            type="button"
            class={[
              "flex w-28 cursor-pointer flex-col items-center gap-2 rounded-box border p-3 text-center transition",
              tile.speaking ? "border-success bg-success/10" : "border-base-content/10 bg-base-100/60",
              !tile.connected && "opacity-60",
            ]}
            onclick={event => profileCardStore.open(tile.userId, event.currentTarget)}
            {@attach contextMenu(() => userSections(tile, false))}
          >
          <Avatar
            name={tile.name}
            mxc={tile.avatarUrl}
            size="lg"
            tone={tile.me ? "primary" : "neutral"}
            class={[
              "ring-2 ring-offset-2 ring-offset-base-100 transition",
              tile.speaking ? "ring-success" : "ring-transparent",
            ]}
          />
          <span class="w-full truncate text-xs" title={tile.name}>
            {tile.me ? i18n.t("voice.stage.me", { name: tile.name }) : tile.name}
          </span>
          {#if !tile.connected}
            <span class="badge badge-ghost badge-xs whitespace-nowrap">{i18n.t("voice.stage.waiting")}</span>
          {:else}
            <Icon
              icon={tile.muted ? "lucide:mic-off" : "lucide:mic"}
              class={["size-3.5", tile.muted ? "text-error" : tile.speaking ? "text-success" : "text-subtle"]}
            />
          {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="flex flex-wrap items-center gap-2">
    {#if joined}
      {#if !groupCallStore.canPlayAudio}
        <button type="button" class="btn btn-sm" onclick={() => groupCallStore.startAudio()}>
          <Icon icon="lucide:volume-2" class="size-4" />
          {i18n.t("voice.stage.enableAudio")}
        </button>
      {/if}
      <AudioToggle
        kind="mic"
        off={groupCallStore.muted}
        disabled={!connected}
        onclick={() => groupCallStore.toggleMute()}
      />
      <button
        type="button"
        class="btn btn-error btn-square btn-sm"
        aria-label={i18n.t("voice.stage.leave")}
        title={i18n.t("voice.stage.leave")}
        disabled={groupCallStore.phase === "leaving"}
        onclick={() => groupCallStore.leave()}
      >
        <Icon icon="lucide:phone-off" class="size-4.5" />
      </button>
    {:else}
      {#if groupCallStore.support === "unavailable"}
        <p class="text-muted text-sm">{i18n.text(GROUP_CALL_UNSUPPORTED)}</p>
      {:else}
        <button
          type="button"
          class="btn btn-success btn-square btn-sm"
          aria-label={i18n.t("voice.stage.join")}
          title={i18n.t("voice.stage.join")}
          disabled={groupCallStore.support !== "available"}
          onclick={join}
        >
          <Icon icon="lucide:phone" class="size-4.5" />
        </button>
      {/if}
    {/if}
  </div>
</section>
