<script lang="ts">
import { getSsgoiTransition, SsgoiLayoutBoundary } from "@ssgoi/svelte"
import { type Snippet, untrack } from "svelte"
import { fade, fly, slide } from "svelte/transition"
import { resizeHandle } from "#lib/attachments/resizeHandle.js"
import ChannelColumn from "#lib/components/channels/ChannelColumn.svelte"
import MemberList from "#lib/components/chat/MemberList.svelte"
import ShellShortcuts from "#lib/components/keymap/ShellShortcuts.svelte"
import ServerRail from "#lib/components/rail/ServerRail.svelte"
import { i18n } from "#lib/i18n/i18n.svelte.js"
import { duration, QUICK_MS, SHEET_MS } from "#lib/motion/durations.js"
import { parseChannelsPath, parseHomeView } from "#lib/routes.js"
import { CHAT_MIN_WIDTH, SIDEBARS, type Sidebar } from "#lib/shell/sidebar.js"
import { chatStore } from "#lib/store/chat.svelte.js"
import { layoutStore } from "#lib/store/layout.svelte.js"
import { sessionStore } from "#lib/store/session.svelte.js"
import { page } from "$app/state"

let { children }: { children: Snippet } = $props()

let chatWidth = $state(0)
let channelWidth = $state(0)
let memberWidth = $state(0)

const transition = getSsgoiTransition()
const client = $derived(sessionStore.client)
const route = $derived(
  parseChannelsPath(page.url.pathname) ?? { spaceId: null, roomId: null },
)
const chatOpen = $derived(
  route.roomId !== null || parseHomeView(page.url.pathname) !== null,
)
const chatVisible = $derived(chatOpen || $transition.status === "transitioning")
const membersColumn = $derived(
  chatOpen &&
    !layoutStore.narrow &&
    layoutStore.membersOpen &&
    chatStore.selected !== null,
)

const slack = $derived(Math.max(0, chatWidth - CHAT_MIN_WIDTH))

const settle = () => {
  if (slack === 0 && channelWidth > 0) {
    layoutStore.settle("channels", channelWidth)

    if (membersColumn && memberWidth > 0) {
      layoutStore.settle("members", memberWidth)
    }
  }
}

$effect(() => untrack(() => layoutStore.watch()))

$effect(() => {
  if (!client) {
    return
  }

  const { spaceId, roomId } = route
  const spaceChanged = chatStore.selectedSpaceId !== spaceId
  const roomChanged = chatStore.selectedRoomId !== roomId

  untrack(() => {
    if (spaceChanged) {
      void chatStore.selectSpace(spaceId)
    }

    if (roomChanged) {
      void chatStore.select(roomId)
    }
  })
})
</script>

{#snippet splitter(side: Sidebar, edge: "start" | "end", label: string, rendered: number)}
  {@const limit = Math.max(
    SIDEBARS[side].min,
    Math.round(Math.min(SIDEBARS[side].max, rendered + slack)),
  )}
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={label}
    aria-valuenow={Math.min(layoutStore.widths[side], limit)}
    aria-valuemin={SIDEBARS[side].min}
    aria-valuemax={limit}
    class={[
      "absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none border-x-3",
      "border-transparent bg-clip-padding transition-colors hover:bg-primary/70",
      "focus-visible:bg-primary/70 data-dragging:bg-primary",
      edge === "end" ? "-end-1" : "-start-1",
    ]}
    {@attach resizeHandle({
      edge,
      ongrab: settle,
      onresize: width => layoutStore.resize(side, width, limit),
      oncommit: () => layoutStore.commitWidths(),
      onreset: () => layoutStore.resetWidth(side),
    })}
  ></div>
{/snippet}

{#if client}
  <ShellShortcuts />

  <div class="relative flex h-full overflow-hidden bg-base-100">
    <div class="flex min-w-0 flex-1 md:contents">
      <ServerRail />
      <div
        class="relative flex min-w-0 flex-1 md:min-w-50 md:flex-initial"
        style:width={layoutStore.narrow ? undefined : `${layoutStore.widths.channels}px`}
        bind:clientWidth={channelWidth}
      >
        <ChannelColumn />
        {#if !layoutStore.narrow}
          {@render splitter("channels", "end", i18n.t("channels.resize.channels"), channelWidth)}
        {/if}
      </div>
    </div>

    <section
      bind:clientWidth={chatWidth}
      class={[
        "min-w-0 flex-col bg-base-100 md:static md:flex md:min-w-70 md:flex-1",
        chatVisible ? "absolute inset-0 z-10 flex" : "hidden",
      ]}
    >
      {#if layoutStore.narrow}
        <SsgoiLayoutBoundary class="flex min-h-0 flex-1 flex-col bg-base-100">
          {@render children()}
        </SsgoiLayoutBoundary>
      {:else}
        {#key page.url.pathname}
          <div class="flex min-h-0 flex-1 flex-col bg-base-100">
            {@render children()}
          </div>
        {/key}
      {/if}
    </section>

    {#if membersColumn}
      <div
        class="relative min-w-50"
        style:width="{layoutStore.widths.members}px"
        bind:clientWidth={memberWidth}
        transition:slide={{ axis: "x", duration: duration(QUICK_MS) }}
      >
        <MemberList />
        {@render splitter("members", "start", i18n.t("channels.resize.members"), memberWidth)}
      </div>
    {/if}
  </div>

  {#if layoutStore.membersSheet && chatStore.selected !== null}
    <button
      type="button"
      class="fixed inset-0 z-30 cursor-pointer bg-base-100/50 backdrop-blur-sm"
      aria-label={i18n.t("channels.members.close")}
      transition:fade={{ duration: duration(QUICK_MS) }}
      onclick={() => layoutStore.toggleMembers()}
    ></button>
    <div
      class="fixed inset-y-0 end-0 z-40 w-60 shadow-xl"
      transition:fly={{
        x: i18n.dir === "rtl" ? -240 : 240,
        duration: duration(SHEET_MS),
      }}
    >
      <MemberList />
    </div>
  {/if}
{/if}
