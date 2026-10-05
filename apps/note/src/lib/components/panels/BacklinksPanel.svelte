<script lang="ts">
  import { backlinks } from "$lib/vault/links"
  import { isNote, stem } from "$lib/vault/paths"
  import { texts } from "$lib/vault/vault.svelte"
  import { filePaths, openPath } from "$lib/workspace/navigate"
  import { focusedTab } from "$lib/workspace/workspace.svelte"

  const path = $derived.by(() => {
    const tab = focusedTab()

    return tab?.path && isNote(tab.path) ? tab.path : null
  })

  const linked = $derived(path ? backlinks(path, texts, filePaths()) : [])
</script>

<div class="min-h-0 flex-1 overflow-y-auto p-2">
  {#if !path}
    <p class="px-1 py-6 text-center text-sm text-base-content/50">
      열린 노트 없음
    </p>
  {:else if linked.length === 0}
    <p class="px-1 py-6 text-center text-sm text-base-content/50">
      백링크 없음
    </p>
  {:else}
    <p class="px-1 pb-2 text-xs text-base-content/45 tabular">
      [{String(linked.length).padStart(2, "0")}] 연결된 노트
    </p>
    <ul class="flex flex-col gap-1">
      {#each linked as link, i (`${link.path}:${i}`)}
        <li>
          <button
            class={[
              "w-full cursor-pointer border border-base-content/10 bg-base-100",
              "px-2.5 py-2 text-left transition hover:border-primary/40",
            ]}
            onclick={() => openPath(link.path)}
          >
            <span class="block truncate text-sm font-medium">
              {stem(link.path)}
            </span>
            <span class="line-clamp-2 text-xs text-base-content/55">
              {link.line}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
