<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { LogEntry } from "./bus"

  let { entries, onclear }: { entries: LogEntry[]; onclear: () => void } =
    $props()

  let filter = $state("")

  const shown = $derived.by(() => {
    const needle = filter.trim().toLowerCase()
    const matched = needle
      ? entries.filter(e =>
          `${e.label} ${e.name} ${e.detail}`.toLowerCase().includes(needle),
        )
      : entries

    return [...matched].reverse()
  })

  const time = (at: number) => new Date(at).toTimeString().slice(0, 8)

  const tones = {
    ipc: "",
    event: "text-info",
    missing: "text-warning",
  }
</script>

<section class="flex min-h-0 flex-col">
  <header class="flex items-center gap-2 px-3 py-2">
    <Icon icon="lucide:scroll-text" class="size-4 text-base-content/60" />

    <h2 class="text-sm font-semibold">IPC log</h2>

    <span class="text-xs text-base-content/50 tabular-nums">{entries.length}</span>

    <span class="grow"></span>

    <label class="input input-xs w-56">
      <Icon icon="lucide:search" class="size-3 shrink-0 opacity-50" />

      <input
        type="search"
        placeholder="Filter"
        aria-label="Filter"
        autocomplete="off"
        spellcheck="false"
        bind:value={filter}
      />
    </label>

    <button type="button" class="btn btn-ghost btn-xs" onclick={onclear}>
      Clear
    </button>
  </header>

  <div class="min-h-0 grow overflow-y-auto px-3 pb-2 select-text">
    {#if shown.length}
      <table class="table table-xs">
        <tbody>
          {#each shown as e (e.id)}
            <tr class={tones[e.kind]}>
              <td class="w-20 text-base-content/50 tabular-nums">{time(e.at)}</td>

              <td class="w-24">
                <span class="badge badge-ghost badge-xs">{e.label}</span>
              </td>

              <td class="w-64 font-medium">
                {e.name}

                {#if e.kind === "missing"}
                  <span class="badge badge-warning badge-xs ml-1">
                    Not mocked
                  </span>
                {/if}
              </td>

              <td class="max-w-0 truncate text-base-content/60" title={e.detail}>
                {e.detail}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <p class="py-6 text-center text-xs text-base-content/50">
        No calls
      </p>
    {/if}
  </div>
</section>
