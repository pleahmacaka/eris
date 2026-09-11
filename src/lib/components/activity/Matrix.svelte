<script lang="ts">
import type { Cell } from "$lib/activity/grid"

let {
  cells,
  source,
  label,
}: {
  cells: (Cell | null)[]
  source: "all" | "github" | "tokscale"
  label: string
} = $props()

const GITHUB = ["bg-cell-0", "bg-gh-1", "bg-gh-2", "bg-gh-3", "bg-gh-4"]

const TOKSCALE = [
  "bg-cell-0",
  "bg-cell-1",
  "bg-cell-2",
  "bg-cell-3",
  "bg-cell-4",
]
</script>

<div
  class="grid auto-cols-fr grid-flow-col grid-rows-7 gap-0.5"
  role="img"
  aria-label={label}
>
  {#each cells as cell, i (i)}
    {#if cell}
      <div class="relative aspect-square overflow-hidden rounded-xs" title={cell.date}>
        {#if source === "tokscale"}
          <div class={["size-full", TOKSCALE[cell.tokscale] ?? TOKSCALE[0]]}></div>
        {:else if source === "github"}
          <div class={["size-full", GITHUB[cell.github] ?? GITHUB[0]]}></div>
        {:else}
          <div
            class={["cell-upper absolute inset-0", GITHUB[cell.github] ?? GITHUB[0]]}
          ></div>
          <div
            class={[
              "cell-lower absolute inset-0",
              TOKSCALE[cell.tokscale] ?? TOKSCALE[0],
            ]}
          ></div>
        {/if}
      </div>
    {:else}
      <div class="aspect-square"></div>
    {/if}
  {/each}
</div>
