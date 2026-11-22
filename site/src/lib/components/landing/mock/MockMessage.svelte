<script lang="ts">
import type { Snippet } from "svelte"
import MockAvatar from "./MockAvatar.svelte"

type Props = { name: string; time: string; mine?: boolean; children: Snippet }

let { name, time, mine = false, children }: Props = $props()
</script>

<div class="flex gap-3 px-3 @2xl:px-4">
  <MockAvatar {name} tone={mine ? "primary" : "neutral"} />

  <div class="flex min-w-0 flex-1 flex-col gap-1">
    <div class="flex items-baseline gap-2">
      <span class={["min-w-0 truncate font-medium", mine && "text-primary"]}>
        {name}
      </span>
      <span
        class="shrink-0 whitespace-nowrap text-2xs text-base-content/60 tabular-nums"
      >
        {time}
      </span>
    </div>

    {@render children()}
  </div>
</div>
