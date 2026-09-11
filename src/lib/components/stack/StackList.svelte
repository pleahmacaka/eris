<script lang="ts">
import type { Group } from "$lib/data/stack"

let { groups }: { groups: Group[] } = $props()
</script>

<ul class="flex flex-col">
  {#each groups as group (group.label())}
    <li
      class={[
        "flex flex-col gap-2 border-base-300 border-t py-4",
        "first:border-t-0 first:pt-0 sm:flex-row sm:items-baseline sm:gap-6",
      ]}
    >
      <p class="shrink-0 font-medium text-sm sm:w-44">{group.label()}</p>

      <ul class="flex flex-wrap gap-1.5">
        {#each group.items as item (item)}
          <li
            class="rounded-field bg-base-200 px-2 py-0.5 text-base-content/70 text-xs"
          >
            {item}
          </li>
        {/each}
      </ul>
    </li>
  {/each}
</ul>
