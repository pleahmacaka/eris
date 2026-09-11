<script lang="ts">
import type { Day } from "$lib/server/activity"

let { days, label }: { days: Day[]; label: string } = $props()

const SHADE = ["bg-cell-0", "bg-cell-1", "bg-cell-2", "bg-cell-3", "bg-cell-4"]
</script>

<div
  class="grid auto-cols-fr grid-flow-col grid-rows-7 gap-0.5"
  role="img"
  aria-label={label}
>
  {#each days as day (day.date)}
    <div
      class={["aspect-square rounded-xs", SHADE[day.level] ?? SHADE[0]]}
      title={day.date}
    ></div>
  {/each}
</div>
