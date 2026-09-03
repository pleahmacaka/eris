<script lang="ts">
  import type { Snippet } from "svelte"

  const {
    title,
    hint = "",
    children,
    aside,
  }: {
    title: string
    hint?: string
    children: Snippet
    aside?: Snippet
  } = $props()
</script>

<section class="mb-7 flex flex-col gap-3">
  <div class="flex items-center justify-between gap-2">
    <h2 class="text-sm font-semibold text-base-content/50">{title}</h2>

    {#if aside}
      {@render aside()}
    {/if}
  </div>

  {#if hint}
    <p class="-mt-1 text-xs text-base-content/45">{hint}</p>
  {/if}

  {@render children()}
</section>
