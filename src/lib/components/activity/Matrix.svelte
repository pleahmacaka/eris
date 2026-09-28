<script lang="ts">
import type { Attachment } from "svelte/attachments"
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

const CASCADE_MS = 11

const cascade = (i: number) =>
  `animation-delay: ${Math.floor(i / 7) * CASCADE_MS}ms`

let seen = $state(false)

const watch: Attachment<HTMLElement> = node => {
  const observer = new IntersectionObserver(
    entries => {
      if (entries.some(e => e.isIntersecting)) {
        seen = true
        observer.disconnect()
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  )

  observer.observe(node)

  return () => observer.disconnect()
}
</script>

<div class="relative" {@attach watch}>
  <div
    class="grid auto-cols-fr grid-flow-col grid-rows-7 gap-0.5"
    role="img"
    aria-label={label}
  >
    {#each cells as cell, i (i)}
      {#if cell}
        <div
          class={[
            "relative aspect-square overflow-hidden rounded-xs",
            "transition hover:brightness-150",
            seen ? "animate-cell-in" : "opacity-0",
          ]}
          style={cascade(i)}
          title={cell.date}
        >
          {#if source === "tokscale"}
            <div
              class={["size-full", TOKSCALE[cell.tokscale] ?? TOKSCALE[0]]}
            ></div>
          {:else if source === "github"}
            <div class={["size-full", GITHUB[cell.github] ?? GITHUB[0]]}></div>
          {:else}
            <div
              class={[
                "cell-upper absolute inset-0",
                GITHUB[cell.github] ?? GITHUB[0],
              ]}
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

  <div
    class={[
      "scan-band pointer-events-none absolute inset-0",
      "animate-scan mix-blend-screen motion-reduce:hidden",
    ]}
    aria-hidden="true"
  ></div>
</div>
