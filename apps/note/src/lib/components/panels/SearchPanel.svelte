<script lang="ts">
  import Icon from "@iconify/svelte"
  import { revealLine } from "$lib/editor/registry"
  import { stem } from "$lib/vault/paths"
  import { texts } from "$lib/vault/vault.svelte"
  import { closePanelsOnNarrow } from "$lib/workspace/layout.svelte"
  import { openPath } from "$lib/workspace/navigate"
  import { focusedTab } from "$lib/workspace/workspace.svelte"

  type Hit = { path: string; lines: { number: number; text: string }[] }

  const LIMIT = 200

  let query = $state("")

  const hits = $derived.by((): Hit[] => {
    const needle = query.trim().toLocaleLowerCase()

    if (needle === "") {
      return []
    }

    const found: Hit[] = []

    for (const [path, text] of texts) {
      const lines = text
        .split("\n")
        .map((line, index) => ({ number: index + 1, text: line.trim() }))
        .filter(line => line.text.toLocaleLowerCase().includes(needle))
        .slice(0, 3)

      if (lines.length > 0 || stem(path).toLocaleLowerCase().includes(needle)) {
        found.push({ path, lines })
      }

      if (found.length >= LIMIT) {
        break
      }
    }

    return found.sort((a, b) => a.path.localeCompare(b.path, "ko"))
  })

  const go = (path: string, line?: number) => {
    openPath(path)
    closePanelsOnNarrow()

    const tab = focusedTab()

    if (line && tab) {
      requestAnimationFrame(() => revealLine(tab.id, line))
    }
  }

  const focusInput = (input: HTMLInputElement) => input.focus()
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="border-b border-base-content/10 p-2">
    <label class="input input-sm w-full">
      <Icon icon="lucide:search" class="size-4 opacity-50" />
      <input
        type="search"
        placeholder="노트 검색"
        bind:value={query}
        use:focusInput
        class="grow"
      />
    </label>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto">
    {#if query.trim() !== "" && hits.length === 0}
      <p class="px-3 py-6 text-center text-sm text-base-content/50">
        검색 결과 없음
      </p>
    {/if}

    <ul>
      {#each hits as hit (hit.path)}
        <li class="border-b border-base-content/5 py-1.5">
          <button
            class={[
              "flex w-full cursor-pointer items-center gap-1.5 px-3 py-1",
              "text-left text-sm font-medium hover:bg-base-content/5",
            ]}
            onclick={() => go(hit.path)}
          >
            <Icon icon="lucide:file-text" class="size-3.5 shrink-0 opacity-50" />
            <span class="truncate">{stem(hit.path)}</span>
          </button>

          {#each hit.lines as line (line.number)}
            <button
              class={[
                "block w-full cursor-pointer truncate px-3 py-0.5 pl-8 text-left",
                "text-xs text-base-content/60 hover:bg-base-content/5",
              ]}
              onclick={() => go(hit.path, line.number)}
            >
              {line.text}
            </button>
          {/each}
        </li>
      {/each}
    </ul>
  </div>
</div>
