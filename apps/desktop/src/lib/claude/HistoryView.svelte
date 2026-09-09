<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import type { Bubble } from "./bubbles.svelte"
  import type { Chat } from "./chat.svelte"
  import { when } from "./text"

  let { chat, current }: { chat: Chat; current: Bubble } = $props()
</script>

<div class="flex min-h-0 grow flex-col px-3 pb-3">
  <div class="flex items-center justify-between px-2 pb-1">
    <p class="text-xs text-base-content/50">{chat.cwd ?? $t("chat.history.home")}</p>

    <button
      type="button"
      class="btn btn-ghost btn-xs"
      onclick={() => (chat.historyOpen = false)}
    >
      <Icon icon="lucide:arrow-left" class="size-3.5" />

      {$t("common.back")}
    </button>
  </div>

  <ul class="min-h-0 grow space-y-0.5 overflow-y-auto">
    {#if chat.session && chat.session.turns.length > 0}
      <li>
        <button
          type="button"
          class="flex w-full flex-col items-start gap-0.5 rounded-field border border-primary/30 bg-primary/10 px-2 py-1.5 text-left"
          onclick={() => (chat.historyOpen = false)}
        >
          <span class="line-clamp-1 text-sm">{chat.titleOf(current)}</span>

          <span class="text-2xs text-primary">{$t("chat.history.current")}</span>
        </button>
      </li>
    {/if}

    {#each chat.history.filter(item => item.id !== chat.session?.info.id) as item (item.id)}
      <li>
        <button
          type="button"
          class="flex w-full flex-col items-start gap-0.5 rounded-field px-2 py-1.5 text-left hover:bg-base-content/10"
          onclick={() => chat.current && chat.fresh(chat.current, item.id)}
        >
          <span class="line-clamp-1 text-sm">{item.title || $t("chat.history.untitled")}</span>

          <span class="text-2xs text-base-content/50">
            {$t("chat.history.meta", { values: { count: item.messages, when: when(item.modified) } })}
          </span>
        </button>
      </li>
    {:else}
      <li class="px-2 py-4 text-sm text-base-content/50">{$t("chat.history.empty")}</li>
    {/each}
  </ul>

  {#if chat.recent.length > 0}
    <p class="px-2 pt-2 pb-1 text-xs text-base-content/50">{$t("chat.history.recentFolders")}</p>

    <ul class="max-h-28 space-y-0.5 overflow-y-auto">
      {#each chat.recent as path (path)}
        <li>
          <button
            type="button"
            class="flex w-full items-center gap-2 truncate rounded-field px-2 py-1 text-left text-xs hover:bg-base-content/10"
            title={path}
            onclick={() => chat.useFolder(path)}
          >
            <Icon icon="lucide:folder" class="size-3.5 shrink-0" />

            <span class="truncate">{path}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
