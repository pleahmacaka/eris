<script lang="ts">
import Icon from "@iconify/svelte"
import { tick } from "svelte"
import { fly } from "svelte/transition"
import Backdrop from "#lib/components/chat/Backdrop.svelte"
import MessageRow from "#lib/components/chat/MessageRow.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import type { TimelineItem } from "#lib/matrix/timeline.js"
import { duration, QUICK_MS } from "#lib/motion/durations.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { keymapStore } from "#lib/store/keymap.svelte.js"

const PAGE_SHARE = 0.9

let scroller = $state<HTMLDivElement>()
let stickToBottom = true
let openedAt = Date.now()

const onScroll = () => {
  if (scroller) {
    stickToBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 40
  }
}

$effect(() => {
  void chatStore.selectedRoomId
  stickToBottom = true
  openedAt = Date.now()
})

$effect(() => {
  void chatStore.items

  if (stickToBottom) {
    void tick().then(() => {
      scroller?.scrollTo({ top: scroller.scrollHeight })
    })
  }
})

const enter = (item: TimelineItem) =>
  item.kind !== "day" && item.ts > openedAt
    ? { y: 6, duration: duration(QUICK_MS) }
    : { duration: 0 }

const older = async () => {
  if (!scroller) {
    return
  }

  const height = scroller.scrollHeight
  const offset = scroller.scrollTop

  await chatStore.paginate()
  await tick()
  scroller.scrollTop = scroller.scrollHeight - height + offset
}

const scrollPage = (direction: 1 | -1) =>
  scroller?.scrollBy({ top: direction * scroller.clientHeight * PAGE_SHARE })

$effect(() =>
  keymapStore.handle({
    scrollUp: () => scrollPage(-1),
    scrollDown: () => scrollPage(1),
  }),
)
</script>

<div
  bind:this={scroller}
  class="relative isolate min-h-0 flex-1 overflow-y-auto py-3"
  onscroll={onScroll}
>
  {#if chatStore.canPaginate}
    <div class="flex justify-center pb-3">
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        disabled={chatStore.paginating}
        onclick={older}
      >
        <span class="grid">
          <span
            class={[
              "col-start-1 row-start-1 flex items-center gap-2",
              chatStore.paginating && "invisible",
            ]}
          >
            <Icon icon="lucide:chevron-up" class="size-4" />
            {i18n.t("chat.history.loadOlder")}
          </span>
          <span
            class={[
              "col-start-1 row-start-1 flex items-center justify-center",
              !chatStore.paginating && "invisible",
            ]}
          >
            <span class="loading loading-spinner loading-xs"></span>
          </span>
        </span>
      </button>
    </div>
  {/if}

  {#if chatStore.items.length === 0 && !chatStore.loadingRoom}
    <div class="relative isolate flex h-full flex-col items-center justify-center gap-3 overflow-hidden">
      <Backdrop strength="faint" />
      <p class="font-black text-2xl tracking-tighter">
        {i18n.t("chat.history.empty")}
      </p>
      <p class="text-muted text-sm">{i18n.t("chat.history.emptyHint")}</p>
    </div>
  {:else if chatStore.items.length > 0}
    <ol class="flex flex-col">
      {#each chatStore.items as item (item.id)}
        <li in:fly={enter(item)}>
          {#if item.kind === "day"}
            <div class="mt-4 flex items-center gap-3 px-4 py-1 text-subtle text-xs">
              <span class="flex-1 border-base-content/10 border-t"></span>
              <span class="whitespace-nowrap">{i18n.format.date(item.ts, { dateStyle: "long" })}</span>
              <span class="flex-1 border-base-content/10 border-t"></span>
            </div>
          {:else if item.kind === "notice"}
            <p class="mt-2 flex items-center gap-2 px-4 text-subtle text-sm">
              <Icon icon="lucide:corner-down-right" class="size-4 shrink-0 rtl:-scale-x-100" />
              <span class="min-w-0 flex-1">{i18n.text(item.message)}</span>
              <span class="whitespace-nowrap text-xs tabular-nums">{i18n.format.time(item.ts)}</span>
            </p>
          {:else}
            <MessageRow {item} />
          {/if}
        </li>
      {/each}
    </ol>
  {/if}
</div>
