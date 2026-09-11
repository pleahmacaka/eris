<script lang="ts">
import type { GearGroup } from "$lib/data/gear"

let { group }: { group: GearGroup } = $props()
</script>

<article class="card h-full border border-base-300 bg-base-100">
  <div class="card-body gap-3 p-5 sm:p-6">
    <h2 class="font-semibold text-lg tracking-tight">{group.label()}</h2>

    <ul class="flex flex-col gap-2 text-sm">
      {#each group.items as item (item.name)}
        <li class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span class="text-base-content/85">{item.name}</span>
          {#if item.note}
            <span class="text-base-content/55 text-xs">{item.note()}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
</article>
