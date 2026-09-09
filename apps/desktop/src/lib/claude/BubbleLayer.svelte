<script lang="ts">
  import { Segmented } from "@eris/ui"
  import Icon from "@iconify/svelte"
  import { cubicOut } from "svelte/easing"
  import { scale } from "svelte/transition"
  import { t } from "svelte-i18n"
  import { editing } from "$lib/edit"
  import type { Chat } from "./chat.svelte"
  import { claudeIcon } from "./icon"
  import { grab, move, release, spawn } from "./stacks"

  const EDIT_SPOT = "bubble"

  let { chat }: { chat: Chat } = $props()

  const hoverOptions = $derived([
    { value: "none" as const, label: $t("chat.hover.none") },
    { value: "title" as const, label: $t("chat.hover.title") },
    { value: "preview" as const, label: $t("chat.hover.preview") },
  ])
</script>

{#each chat.bubbles as b (b.id)}
  {@const p = chat.at(b)}
  {@const mood = chat.moodOf(b)}
  {@const isOpen = chat.openId === b.id}
  {@const isHover = chat.hovered?.id === b.id && !isOpen}
  {@const tip = isHover ? chat.tipOf(b) : ""}
  {@const right = chat.cornerOf(b).right}

  <div
    class={[
      "absolute transition-[left,top] duration-200 ease-out",
      chat.dragged?.stack === b.stack && "transition-none",
    ]}
    style:left="{p.left}px"
    style:top="{p.top}px"
    style:width="{chat.sizes.bubble}px"
    style:height="{chat.sizes.bubble}px"
    style:--bubble={chat.colorOf(b)}
    role="group"
    aria-label={chat.titleOf(b)}
    onpointerenter={() => (chat.hoverId = b.id)}
    onpointerleave={() => {
      if (chat.hoverId === b.id) {
        chat.hoverId = null
      }
    }}
  >
    <button
      type="button"
      class={[
        "bubble relative flex size-full cursor-grab items-center justify-center rounded-full border border-base-content/15 bg-base-100 transition-[filter] duration-200 ease-out hover:brightness-110 active:cursor-grabbing",
        `bubble-${mood}`,
        isOpen && "bubble-open",
        chat.dragged?.id === b.id && chat.moved && "brightness-110",
      ]}
      aria-label={chat.titleOf(b)}
      aria-expanded={isOpen}
      onpointerdown={e => grab(chat, e, b)}
      onpointermove={e => move(chat, e)}
      onpointerup={e => release(chat, e)}
      onpointercancel={e => release(chat, e)}
    >
      <Icon icon={claudeIcon} class="size-6 text-primary" />

      {#if mood === "unread"}
        <span class="bubble-dot" aria-hidden="true"></span>
      {/if}
    </button>

    {#if editing.on}
      {@const spotOpen = editing.open === EDIT_SPOT}

      <button
        type="button"
        class={[
          "absolute inset-0 z-40 rounded-full ring-2 ring-primary/70 transition-colors duration-150",
          spotOpen ? "bg-primary/25" : "bg-primary/10 hover:bg-primary/20",
        ]}
        aria-label={$t("edit.spots.bubble")}
        aria-haspopup="dialog"
        aria-expanded={spotOpen}
        onclick={() => (editing.open = spotOpen ? null : EDIT_SPOT)}
      >
        <span class="badge badge-primary badge-xs absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
          {$t("edit.spots.bubble")}
        </span>
      </button>

      {#if spotOpen}
        <div
          class={[
            "absolute bottom-0 z-50 w-80 rounded-box border border-base-content/10 bg-base-100/95 p-3 shadow-xl backdrop-blur-xl",
            right ? "right-full mr-3" : "left-full ml-3",
          ]}
          role="dialog"
          aria-label={$t("edit.spots.bubble")}
        >
          <div class="mb-2 text-xs font-semibold text-base-content/60">{$t("edit.spots.bubble")}</div>

          <div class="flex flex-col gap-1">
            <label class="flex flex-col gap-1 py-1 text-xs">
              <span class="flex justify-between">
                <span>{$t("settings.rows.snapDistance")}</span>

                <span class="text-base-content/60 tabular-nums">{chat.device.chatSnap}%</span>
              </span>

              <input
                type="range"
                class="range range-primary range-xs"
                min="0"
                max="50"
                step="1"
                value={chat.device.chatSnap}
                oninput={e => (chat.device = { ...chat.device, chatSnap: Number(e.currentTarget.value) })}
                onchange={e => chat.patchDevice("chatSnap", Number(e.currentTarget.value))}
              />
            </label>

            <div class="flex items-center justify-between gap-3 py-1 text-xs">
              <span>{$t("settings.rows.chatHover")}</span>

              <Segmented value={chat.device.chatHover} options={hoverOptions} onchange={v => chat.patchDevice("chatHover", v)} />
            </div>

            <label class="flex items-center justify-between gap-3 py-1 text-xs">
              <span>{$t("settings.rows.chatMultiBubble")}</span>

              <input
                type="checkbox"
                class="toggle toggle-primary toggle-xs"
                checked={chat.device.chatMultiBubble}
                onchange={e => chat.patchDevice("chatMultiBubble", e.currentTarget.checked)}
              />
            </label>

            <label class="flex items-center justify-between gap-3 py-1 text-xs">
              <span>{$t("settings.rows.chatBubbleColors")}</span>

              <input
                type="checkbox"
                class="toggle toggle-primary toggle-xs"
                checked={chat.device.chatBubbleColors}
                onchange={e => chat.patchDevice("chatBubbleColors", e.currentTarget.checked)}
              />
            </label>
          </div>
        </div>
      {/if}
    {/if}

    {#if isHover && chat.device.chatMultiBubble}
      <button
        type="button"
        class="bubble-plus"
        style:top="{-chat.sizes.plus / 2}px"
        style:width="{chat.sizes.plus}px"
        style:height="{chat.sizes.plus}px"
        aria-label={$t("chat.newBubble")}
        title={$t("chat.newBubble")}
        onclick={() => spawn(chat, b, true)}
      >
        <Icon icon="lucide:plus" class="size-3" />
      </button>

      <button
        type="button"
        class="bubble-plus"
        style:bottom="{-chat.sizes.plus / 2}px"
        style:width="{chat.sizes.plus}px"
        style:height="{chat.sizes.plus}px"
        aria-label={$t("chat.newBubble")}
        title={$t("chat.newBubble")}
        onclick={() => spawn(chat, b, false)}
      >
        <Icon icon="lucide:plus" class="size-3" />
      </button>
    {/if}

    {#if tip}
      <div
        bind:clientWidth={chat.tipWidth}
        bind:clientHeight={chat.tipHeight}
        class="pointer-events-none absolute z-10 w-max max-w-56 rounded-field border border-base-content/10 bg-base-100 px-2.5 py-1.5 text-xs shadow-lg"
        style:left={right ? "auto" : `${chat.sizes.bubble + chat.sizes.tipGap}px`}
        style:right={right ? `${chat.sizes.bubble + chat.sizes.tipGap}px` : "auto"}
        style:top="{chat.sizes.bubble / 2 - chat.tipHeight / 2}px"
        role="tooltip"
      >
        <span class="line-clamp-3">{tip}</span>
      </div>
    {/if}
  </div>
{/each}

{#if chat.dragging}
  <div
    class={[
      "absolute flex items-center justify-center rounded-full border transition-[transform,background-color] duration-150",
      chat.overTarget
        ? "scale-125 border-error/40 bg-error/80 text-error-content"
        : "border-base-content/10 bg-base-100/80 text-base-content/70",
    ]}
    style:left="{chat.targetX - chat.sizes.target / 2}px"
    style:top="{chat.targetY - chat.sizes.target / 2}px"
    style:width="{chat.sizes.target}px"
    style:height="{chat.sizes.target}px"
    transition:scale={{ duration: 160, start: 0.4, easing: cubicOut }}
    aria-hidden="true"
  >
    <Icon icon="lucide:x" class="size-7" />
  </div>
{/if}

<style>
  .bubble {
    box-shadow: inset 0 0 0 0.125rem color-mix(in oklch, var(--bubble) 40%, transparent);
  }

  .bubble-open {
    box-shadow: inset 0 0 0 0.125rem var(--bubble);
  }

  .bubble-other {
    box-shadow: inset 0 0 0 0.125rem color-mix(in oklch, var(--color-secondary) 55%, transparent);
  }

  .bubble-attention {
    animation: bubble-pulse 1.2s ease-in-out infinite;
  }

  .bubble-unread {
    box-shadow: inset 0 0 0 0.125rem var(--bubble);
    animation: bubble-nudge 0.6s ease-out 1;
  }

  .bubble-busy {
    box-shadow: none;
  }

  .bubble-busy::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    background: conic-gradient(from 0deg, transparent 0 62%, var(--bubble) 100%);
    mask: radial-gradient(farthest-side, transparent calc(100% - 0.1875rem), #000 calc(100% - 0.1875rem));
    animation: bubble-spin 1.4s linear infinite;
  }

  .bubble-dot {
    position: absolute;
    top: 0.3125rem;
    right: 0.3125rem;
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 9999px;
    background: var(--bubble);
    box-shadow: 0 0 0 0.125rem var(--color-base-100);
  }

  .bubble-plus {
    position: absolute;
    left: 50%;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    translate: -50% 0;
    border-radius: 9999px;
    border: 1px solid color-mix(in oklch, var(--color-base-content) 15%, transparent);
    background: var(--color-base-100);
    color: color-mix(in oklch, var(--color-base-content) 70%, transparent);
    box-shadow: 0 0.0625rem 0.25rem color-mix(in oklch, var(--color-base-content) 15%, transparent);
  }

  .bubble-plus:hover {
    background: var(--bubble);
    color: var(--color-base-100);
  }

  @keyframes bubble-spin {
    to {
      transform: rotate(1turn);
    }
  }

  @keyframes bubble-pulse {
    0%,
    100% {
      box-shadow: inset 0 0 0 0.125rem var(--color-warning);
    }

    50% {
      box-shadow: inset 0 0 0 0.375rem color-mix(in oklch, var(--color-warning) 35%, transparent);
    }
  }

  @keyframes bubble-nudge {
    0%,
    100% {
      translate: 0 0;
    }

    30% {
      translate: 0 -0.375rem;
    }

    60% {
      translate: 0 0.0625rem;
    }
  }
</style>
