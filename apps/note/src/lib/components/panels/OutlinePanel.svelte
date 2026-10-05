<script lang="ts">
  import { revealLine } from "$lib/editor/registry"
  import { outline } from "$lib/markdown/outline"
  import { isNote } from "$lib/vault/paths"
  import { texts } from "$lib/vault/vault.svelte"
  import { focusedTab } from "$lib/workspace/workspace.svelte"

  const tab = $derived(focusedTab())

  const headings = $derived(
    tab?.path && isNote(tab.path) ? outline(texts.get(tab.path) ?? "") : null,
  )
</script>

<div class="min-h-0 flex-1 overflow-y-auto p-2">
  {#if headings === null}
    <p class="px-1 py-6 text-center text-sm text-base-content/50">
      열린 노트 없음
    </p>
  {:else if headings.length === 0}
    <p class="px-1 py-6 text-center text-sm text-base-content/50">
      제목 없음
    </p>
  {:else}
    <ul>
      {#each headings as heading (heading.line)}
        <li>
          <button
            class={[
              "flex w-full cursor-pointer items-baseline gap-1.5 py-1 pr-2",
              "text-left text-sm text-base-content/70 hover:text-base-content",
            ]}
            style:padding-left="{(heading.level - 1) * 0.875 + 0.5}rem"
            onclick={() => tab && revealLine(tab.id, heading.line)}
          >
            <span class="shrink-0 text-xs text-primary/70" aria-hidden="true">
              {"#".repeat(heading.level)}
            </span>
            <span class="truncate">{heading.text}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
