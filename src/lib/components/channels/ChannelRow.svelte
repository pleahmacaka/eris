<script lang="ts">
import Icon from "@iconify/svelte"
import { fade } from "svelte/transition"
import { contextMenu } from "#lib/attachments/contextMenu.js"
import Avatar from "#lib/components/ui/Avatar.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { participantIdentity } from "#lib/matrix/groupCall.js"
import type { RoomDigest } from "#lib/matrix/rooms.js"
import { roomSections } from "#lib/menu/actions.js"
import { duration, QUICK_MS } from "#lib/motion/durations.js"
import { groupCallStore } from "#lib/store/groupCall.svelte.js"

type Props = { room: RoomDigest; selected: boolean; onselect: () => void }

let { room, selected, onselect }: Props = $props()

const listed = $derived(room.membership === "none")
const inCall = $derived(groupCallStore.roomId === room.id)
const liveFor = (userId: string, deviceId: string) =>
  inCall
    ? groupCallStore.participants.find(
        p => p.key === participantIdentity(userId, deviceId),
      )
    : undefined

const participants = $derived(
  [...Map.groupBy(room.callMembers, member => member.userId)].map(
    ([userId, devices]) => {
      const live = devices.map(device => liveFor(userId, device.deviceId))

      return {
        key: userId,
        name: devices[0].name,
        avatarUrl: devices[0].avatarUrl,
        speaking: live.some(entry => entry?.speaking),
        muted: live.every(entry => entry?.muted ?? false),
      }
    },
  ),
)
</script>

<div transition:fade={{ duration: duration(QUICK_MS) }}>
  <button
    type="button"
    class={[
      "group flex w-full cursor-pointer items-center gap-2 rounded-field px-2 py-1.5",
      "text-start",
      selected
        ? "bg-base-content/10 text-base-content"
        : room.unread > 0 && !listed
          ? "font-semibold text-base-content hover:bg-base-content/5"
          : "text-muted hover:bg-base-content/5 hover:text-base-content",
    ]}
    aria-current={selected ? "page" : undefined}
    onclick={onselect}
    {@attach contextMenu(() => roomSections(room, "channel", onselect))}
  >
    <Icon
      icon={room.kind === "voice" ? "lucide:volume-2" : "lucide:hash"}
      class="size-4 shrink-0"
    />
    <span class="min-w-0 flex-1 truncate" title={room.name}>{room.name}</span>
    {#if listed}
      <span class="badge badge-ghost badge-xs whitespace-nowrap">{i18n.t("channels.voice.joined")}</span>
    {:else if room.unread > 0 && !selected}
      <span class="badge badge-primary badge-xs whitespace-nowrap tabular-nums">
        {room.unread > 99 ? "99+" : room.unread}
      </span>
    {/if}
  </button>

  {#if room.kind === "voice" && participants.length > 0}
    <ul class="ms-6 flex flex-col gap-0.5 py-1" aria-label={i18n.t("channels.voice.participants")}>
      {#each participants as participant (participant.key)}
        <li
          class="flex items-center gap-2 px-2 py-0.5 text-muted text-sm"
          transition:fade={{ duration: duration(QUICK_MS) }}
        >
          <Avatar
            name={participant.name}
            mxc={participant.avatarUrl}
            size="xs"
            class={[
              "ring-2 ring-offset-2 ring-offset-base-200 transition",
              participant.speaking ? "ring-success" : "ring-transparent",
            ]}
          />
          <span class="min-w-0 flex-1 truncate">{participant.name}</span>
          {#if participant.muted}
            <Icon icon="lucide:mic-off" class="size-3.5 text-subtle" />
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>
