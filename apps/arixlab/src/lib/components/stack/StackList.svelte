<script lang="ts">
import type { Group } from "$lib/data/stack"

let { groups }: { groups: Group[] } = $props()
</script>

<ul class="hud flex flex-col bg-base-100/60 px-5 sm:px-7">
  {#each groups as group, i (group.label())}
    <li
      class={[
        "flex flex-col gap-3 border-base-300 border-t py-5 first:border-t-0",
        "sm:flex-row sm:items-baseline sm:gap-6",
      ]}
    >
      <p class="flex shrink-0 items-baseline gap-3 text-sm sm:w-52">
        <span class="text-primary text-xs tabular-nums">
          {String(i + 1).padStart(2, "0")}
        </span>
        <span class="font-medium">{group.label()}</span>
      </p>

      <ul class="flex flex-wrap gap-1.5">
        {#each group.items as item (item)}
          <li
            class={[
              "border border-base-300 px-2 py-0.5 text-base-content/75 text-xs",
              "transition hover:border-primary/60 hover:text-base-content",
            ]}
          >
            {item}
          </li>
        {/each}
      </ul>
    </li>
  {/each}
</ul>
