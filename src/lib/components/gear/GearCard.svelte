<script lang="ts">
import type { GearGroup } from "$lib/data/gear"

let { group, index }: { group: GearGroup; index: number } = $props()

const label = $derived(String(index).padStart(2, "0"))
</script>

<article
  class={[
    "hud flex h-full flex-col gap-4 bg-base-100/60 p-5",
    "hover:hud-lit sm:p-6",
  ]}
>
  <div class="flex items-baseline justify-between gap-3">
    <h3 class="font-semibold text-lg tracking-tight">{group.label()}</h3>
    <span class="text-primary text-xs tabular-nums">{label}</span>
  </div>

  <ul class="flex flex-col gap-3 text-sm">
    {#each group.items as item (item.name)}
      <li class="flex flex-col gap-0.5 border-base-300 border-l pl-3">
        <span class="text-base-content/90">{item.name}</span>
        {#if item.note}
          <span class="text-base-content/65 text-xs">{item.note()}</span>
        {/if}
        {#if item.spec}
          <span class="text-base-content/65 text-xs leading-relaxed">
            {item.spec}
          </span>
        {/if}
      </li>
    {/each}
  </ul>
</article>
