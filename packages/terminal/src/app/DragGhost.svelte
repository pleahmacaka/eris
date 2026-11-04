<script lang="ts">
  import { rootRem } from "@eris/ui"
  import Icon from "@iconify/svelte"
  import { scale } from "svelte/transition"
  import { shellIcon } from "../shell-icons"
  import { drag } from "./drag.svelte"

  const GAP = 12

  let width = $state(0)
  let height = $state(0)
  let innerWidth = $state(0)
  let innerHeight = $state(0)

  const look = $derived(drag.card ? shellIcon(drag.card.shell) : null)

  const left = $derived(
    drag.x + GAP + width > innerWidth ? drag.x - GAP - width : drag.x + GAP,
  )

  const top = $derived(
    drag.y + GAP + height > innerHeight ? drag.y - GAP - height : drag.y + GAP,
  )
</script>

<svelte:window bind:innerWidth bind:innerHeight />

{#if drag.tab !== null && drag.card && look}
  <div
    class={[
      "pointer-events-none fixed z-50 flex max-w-64 -rotate-2 items-center gap-2",
      "rounded-field border border-primary/40 bg-base-200/90 px-3 py-1.5 text-sm",
      "shadow-xl shadow-primary/10 backdrop-blur-md",
    ]}
    style:left="{left / rootRem()}rem"
    style:top="{top / rootRem()}rem"
    bind:clientWidth={width}
    bind:clientHeight={height}
    transition:scale={{ start: 0.9, duration: 120 }}
  >
    <Icon
      icon={look.icon}
      class="size-4 shrink-0"
      style={look.color ? `color: ${look.color}` : undefined}
    />

    <span class="truncate">{drag.card.title}</span>

    {#if drag.card.panes > 1}
      <span class="badge badge-xs badge-primary">{drag.card.panes}</span>
    {/if}
  </div>
{/if}
