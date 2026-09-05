<script lang="ts">
  import { listen } from "@tauri-apps/api/event"
  import * as native from "$lib/native"
  import type { SpectrumStyle } from "$lib/settings"

  type Props = {
    style?: SpectrumStyle
    bars?: number
    height?: number
    gap?: number
  }

  let { style = "bars", bars = 24, height = 18, gap = 2 }: Props = $props()

  let levels = $state<number[]>([])

  $effect(() => {
    native.spectrumStart().catch(() => undefined)

    const stop = listen<number[]>("spectrum", e => {
      levels = e.payload
    })

    return () => {
      stop.then(off => off()).catch(() => undefined)
      native.spectrumStop().catch(() => undefined)
    }
  })

  const shown = $derived.by(() => {
    if (levels.length === 0) {
      return Array.from({ length: bars }, () => 0)
    }

    const step = levels.length / bars

    return Array.from({ length: bars }, (_, index) => {
      const from = Math.floor(index * step)
      const to = Math.max(from + 1, Math.floor((index + 1) * step))

      return Math.max(...levels.slice(from, to))
    })
  })

  const size = (level: number) => Math.max(2, Math.round(level * height))
</script>

<div
  class="flex items-end"
  style:height="{height}px"
  style:gap="{gap}px"
  aria-hidden="true"
>
  {#each shown as level, index (index)}
    {#if style === "dots"}
      <span
        class="w-1 shrink-0 rounded-full bg-primary transition-[height,opacity] duration-75"
        style:height="{Math.max(2, Math.round(level * 4) + 2)}px"
        style:opacity={0.25 + level * 0.75}
        style:margin-bottom="{Math.round(level * (height - 4))}px"
      ></span>
    {:else if style === "mirror"}
      <span
        class="flex w-1 shrink-0 flex-col items-center justify-center gap-px"
        style:height="{height}px"
      >
        <span
          class="w-full rounded-full bg-primary/70 transition-[height] duration-75"
          style:height="{size(level) / 2}px"
        ></span>

        <span
          class="w-full rounded-full bg-primary/40 transition-[height] duration-75"
          style:height="{size(level) / 2}px"
        ></span>
      </span>
    {:else if style === "wave"}
      <span
        class="w-1 shrink-0 rounded-full bg-gradient-to-t from-primary/30 to-primary transition-[height] duration-100"
        style:height="{size(level)}px"
      ></span>
    {:else}
      <span
        class="w-1 shrink-0 rounded-sm bg-primary transition-[height] duration-75"
        style:height="{size(level)}px"
        style:opacity={0.45 + level * 0.55}
      ></span>
    {/if}
  {/each}
</div>
