<script lang="ts">
  import Icon from "@iconify/svelte"
  import { cubicOut } from "svelte/easing"
  import { scale } from "svelte/transition"
  import { t } from "svelte-i18n"
  import type { Chat } from "./chat.svelte"
  import Composer from "./Composer.svelte"
  import ConfigSheet from "./ConfigSheet.svelte"
  import HistoryView from "./HistoryView.svelte"
  import Thread from "./Thread.svelte"

  let { chat }: { chat: Chat } = $props()
</script>

{#if chat.current && !chat.dragging}
  {@const current = chat.current}

  <section
    bind:this={chat.panel}
    class="absolute isolate flex flex-col overflow-hidden rounded-box border border-base-content/10 bg-base-100"
    style:left="{chat.panelLeft}px"
    style:top="{chat.panelTop}px"
    style:width="{chat.sizes.panelWidth}px"
    style:height="{chat.sizes.panelHeight}px"
    style:transform-origin={chat.origin}
    style:--bubble={chat.colorOf(current)}
    transition:scale={{ duration: 220, start: 0.88, easing: cubicOut }}
    aria-label={chat.titleOf(current)}
  >
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-primary/15 to-transparent"
      aria-hidden="true"
    ></div>

    <header class="flex shrink-0 items-center gap-1 px-4 pt-3 pb-2">
      <span class="bubble-swatch" aria-hidden="true"></span>

      {#if chat.editingTitle}
        <input
          bind:this={chat.titleInput}
          bind:value={chat.titleDraft}
          class="input input-ghost input-xs w-40 text-sm font-medium"
          aria-label={$t("chat.rename")}
          onkeydown={e => {
            if (e.key === "Enter") {
              chat.commitRename()
            }

            if (e.key === "Escape") {
              e.stopPropagation()
              chat.editingTitle = false
            }
          }}
          onblur={() => chat.commitRename()}
        />
      {:else}
        <button
          type="button"
          class="max-w-40 truncate text-sm font-medium tracking-tight"
          title={$t("chat.rename")}
          onclick={() => chat.startRename()}
        >
          {chat.titleOf(current)}
        </button>
      {/if}

      {#if current.folder}
        <span
          class="inline-flex max-w-32 items-center rounded-field bg-base-content/5 pl-2 text-xs"
        >
          <Icon icon="lucide:folder" class="size-3.5 shrink-0" />

          <button
            type="button"
            class="truncate px-1 py-1"
            title={current.folder}
            onclick={() => chat.chooseFolder()}
          >
            {chat.folderName}
          </button>

          <button
            type="button"
            class="btn btn-circle btn-ghost btn-xs"
            aria-label={$t("chat.closeFolder")}
            onclick={() => chat.closeFolder()}
          >
            <Icon icon="lucide:x" class="size-3" />
          </button>
        </span>
      {:else}
        <button
          type="button"
          class="btn btn-ghost btn-xs gap-1 font-normal"
          onclick={() => chat.chooseFolder()}
        >
          <Icon icon="lucide:folder-open" class="size-3.5" />

          {$t("chat.openFolder")}
        </button>
      {/if}

      <span class="grow"></span>

      <button
        type="button"
        class={["btn btn-circle btn-ghost btn-xs", chat.configOpen && "btn-active"]}
        title={$t("chat.config.title")}
        aria-label={$t("chat.config.title")}
        onclick={() => {
          chat.configOpen = !chat.configOpen
          chat.historyOpen = false
        }}
      >
        <Icon icon="lucide:sliders-horizontal" class="size-4" />
      </button>

      <button
        type="button"
        class="btn btn-circle btn-ghost btn-xs"
        title={$t("chat.history.title")}
        aria-label={$t("chat.history.title")}
        onclick={() => chat.loadHistory()}
      >
        <Icon icon="lucide:history" class="size-4" />
      </button>

      <button
        type="button"
        class="btn btn-circle btn-ghost btn-xs"
        title={$t("chat.newChat")}
        aria-label={$t("chat.newChat")}
        onclick={() => chat.current && chat.fresh(chat.current)}
      >
        <Icon icon="lucide:plus" class="size-4" />
      </button>

      <button
        type="button"
        class="btn btn-circle btn-ghost btn-xs"
        aria-label={$t("common.close")}
        onclick={() => chat.closePanel()}
      >
        <Icon icon="lucide:x" class="size-4" />
      </button>
    </header>

    {#if chat.configOpen}
      <ConfigSheet {chat} />
    {:else if chat.historyOpen}
      <HistoryView {chat} {current} />
    {:else}
      <Thread {chat} {current} />
    {/if}

    <Composer {chat} />
  </section>
{/if}

<style>
  .bubble-swatch {
    width: 0.5rem;
    height: 0.5rem;
    flex-shrink: 0;
    border-radius: 9999px;
    background: var(--bubble);
  }
</style>
