<script lang="ts">
import { cells } from "$lib/activity/grid"
import { scramble } from "$lib/motion/scramble"
import * as m from "$lib/paraglide/messages"
import { getLocale } from "$lib/paraglide/runtime"
import type { Window } from "$lib/server/activity"
import Matrix from "./Matrix.svelte"

type Source = "all" | "github" | "tokscale"

let { windows }: { windows: Window[] } = $props()

let picked = $state<string | null>(null)

let wanted = $state<Source>("all")

const active = $derived(windows.find(w => w.key === picked) ?? windows[0])

const paired = $derived(active.tokscale !== null)

const source = $derived<Source>(paired ? wanted : "github")

const grid = $derived(cells(active))

const format = (value: number) => value.toLocaleString(getLocale())

const SOURCES: { key: Source; label: string; swatch: string[] }[] = [
  { key: "all", label: m.activity_all(), swatch: ["bg-gh-3", "bg-cell-3"] },
  { key: "github", label: "GitHub", swatch: ["bg-gh-3"] },
  { key: "tokscale", label: "Tokscale", swatch: ["bg-cell-3"] },
]

const tab = (active: boolean, disabled: boolean) => [
  "btn btn-xs gap-1.5 border-0",
  active
    ? "bg-neutral-content/15 text-neutral-content"
    : "bg-transparent text-neutral-content/55 hover:bg-neutral-content/8",
  disabled && "cursor-not-allowed opacity-35",
]
</script>

<div
  class={[
    "rounded-box bg-neutral text-neutral-content",
    "flex flex-col gap-5 p-5 sm:p-7",
  ]}
>
  <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
    <div class="join">
      {#each SOURCES as option (option.key)}
        <button
          class={["join-item", ...tab(source === option.key, !paired && option.key !== "github")]}
          type="button"
          disabled={!paired && option.key !== "github"}
          title={!paired && option.key !== "github" ? m.tokscale_window() : undefined}
          onclick={() => (wanted = option.key)}
        >
          <span class="flex shrink-0 items-center gap-0.5 self-center">
            {#each option.swatch as tone (tone)}
              <span class={["size-2 rounded-xs", tone]}></span>
            {/each}
          </span>
          {option.label}
        </button>
      {/each}
    </div>

    <div class="flex flex-wrap gap-1">
      {#each windows as option (option.key)}
        <button
          class={tab(active.key === option.key, false)}
          type="button"
          onclick={() => (picked = option.key)}
        >
          {option.key === "rolling" ? m.activity_rolling() : option.key}
        </button>
      {/each}
    </div>
  </div>

  {#key `${active.key}-${source}`}
    <div class="flex flex-wrap gap-x-6 gap-y-1 text-neutral-content/65 text-sm">
      {#if source !== "tokscale"}
        <p use:scramble={{ duration: 520 }}>
          {m.contributions({ count: format(active.githubTotal) })}
        </p>
      {/if}
      {#if source !== "github" && active.tokscaleActive !== null}
        <p use:scramble={{ delay: 80, duration: 520 }}>
          {m.active_days({ count: format(active.tokscaleActive) })}
        </p>
      {/if}
    </div>
  {/key}

  <Matrix cells={grid} {source} label={m.section_activity()} />
</div>
