<script lang="ts">
  import type { Snippet } from "svelte"

  let {
    label,
    hint,
    value,
    stacked = false,
    children,
  }: {
    label: string
    hint?: string
    value?: string
    stacked?: boolean
    children: Snippet
  } = $props()
</script>

<div
  data-row={label}
  class={[
    "flex gap-4 px-4 py-3",
    stacked ? "flex-col" : "items-center justify-between",
  ]}
>
  <div class="flex min-w-0 grow items-center justify-between gap-3">
    <div class="flex min-w-0 flex-col">
      <span class="text-sm font-medium">{label}</span>

      {#if hint}
        <span class="text-xs text-base-content/60">{hint}</span>
      {/if}
    </div>

    {#if value !== undefined}
      <span class="text-xs text-base-content/70 tabular-nums">{value}</span>
    {/if}
  </div>

  <div class={["shrink-0", stacked && "w-full"]}>
    {@render children()}
  </div>
</div>
