<script lang="ts">
import { contextMenu } from "#lib/attachments/contextMenu.js"
import MessageBody from "#lib/components/chat/MessageBody.svelte"
import Avatar from "#lib/components/ui/Avatar.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { ChatMessage } from "#lib/matrix/timeline.js"
import { messageSections, userSections } from "#lib/menu/actions.js"
import { profileCardStore } from "#lib/store/profileCard.svelte.js"

let { item }: { item: ChatMessage } = $props()

const messageMenu = contextMenu(() => messageSections(item))
const authorMenu = contextMenu(() =>
  userSections({ userId: item.senderId, name: item.senderName }, true),
)

const highlight = $derived(
  item.mentionsMe
    ? "border-accent bg-accent/10 hover:bg-accent/15"
    : "border-transparent hover:bg-base-content/5",
)

const openProfile = (event: MouseEvent & { currentTarget: HTMLElement }) =>
  profileCardStore.open(item.senderId, event.currentTarget)
</script>

{#if item.continued}
  <div
    class={[
      "group flex gap-4 border-s-2 px-4 py-0.5",
      highlight,
      item.pending && "opacity-60",
    ]}
    {@attach messageMenu}
  >
    <span
      class={[
        "w-10 shrink-0 self-center text-end text-2xs text-subtle",
        "tabular-nums opacity-0 transition group-hover:opacity-100",
      ]}
    >
      {i18n.format.time(item.ts)}
    </span>
    <div class="min-w-0 flex-1">
      <MessageBody {item} />
    </div>
  </div>
{:else}
  <div
    class={[
      "group mt-4 flex gap-4 border-s-2 px-4 py-0.5",
      highlight,
      item.pending && "opacity-60",
    ]}
    {@attach messageMenu}
  >
    <button
      type="button"
      class="mt-0.5 h-fit shrink-0 cursor-pointer rounded-selector"
      aria-label={i18n.t("chat.message.authorProfile", { name: item.senderName })}
      onclick={openProfile}
      {@attach authorMenu}
    >
      <Avatar
        name={item.senderName}
        mxc={item.senderAvatarUrl}
        tone={item.mine ? "primary" : "neutral"}
      />
    </button>
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <button
          type="button"
          class={[
            "cursor-pointer truncate font-medium hover:underline",
            item.mine && "text-primary",
          ]}
          title={item.senderId}
          onclick={openProfile}
          {@attach authorMenu}
        >
          {item.senderName}
        </button>
        <span class="whitespace-nowrap text-subtle text-xs tabular-nums">
          {i18n.format.dateTime(item.ts)}
        </span>
      </div>
      <MessageBody {item} />
    </div>
  </div>
{/if}
