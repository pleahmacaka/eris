<script lang="ts">
import { fade } from "svelte/transition"
import { contextMenu } from "#lib/attachments/contextMenu.js"
import Avatar from "#lib/components/ui/Avatar.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { type RoomDigest, roomPreview } from "#lib/matrix/rooms.js"
import { dmSections } from "#lib/menu/actions.js"
import { duration, QUICK_MS } from "#lib/motion/durations.js"
import { listPrefsStore } from "#lib/store/listPrefs.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"

type Props = { room: RoomDigest; selected: boolean; onselect: () => void }

let { room, selected, onselect }: Props = $props()

const message = $derived(
  roomPreview(room.lastEvent, sessionStore.session?.userId ?? ""),
)
const preview = $derived(message === null ? "" : i18n.text(message))
</script>

<button
  type="button"
  class={[
    "flex min-h-10.5 w-full cursor-pointer items-center gap-3 rounded-field px-2 py-1",
    "text-start",
    selected
      ? "bg-base-content/10 text-base-content"
      : "text-muted hover:bg-base-content/5 hover:text-base-content",
  ]}
  aria-current={selected ? "page" : undefined}
  onclick={onselect}
  transition:fade={{ duration: duration(QUICK_MS) }}
  {@attach contextMenu(() => dmSections(room, onselect))}
>
  <Avatar name={room.name} mxc={room.avatarUrl} size="sm" tone="primary" />
  <span class="flex min-w-0 flex-1 flex-col">
    <span
      class={[
        "truncate font-medium text-[0.9375rem] leading-5",
        room.unread > 0 && "font-semibold text-base-content",
      ]}
      title={room.name}
    >
      {room.name}
    </span>
    {#if listPrefsStore.dmPreview && preview !== ""}
      <span class="truncate text-subtle text-xs leading-4" title={preview}>
        {preview}
      </span>
    {/if}
  </span>
  {#if room.unread > 0 && !selected}
    <span class="badge badge-primary badge-xs whitespace-nowrap tabular-nums">
      {room.unread > 99
        ? i18n.t("chat.unread.overflow", { count: 99 })
        : i18n.format.number(room.unread)}
    </span>
  {/if}
</button>
