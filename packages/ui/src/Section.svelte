<script lang="ts">
  import type { Snippet } from "svelte"

  let {
    title,
    description,
    aside,
    children,
  }: {
    title: string
    description?: string
    aside?: Snippet
    children: Snippet
  } = $props()
</script>

<section data-group={title} class="flex scroll-mt-16 flex-col gap-2">
  <header class="flex items-end justify-between gap-3 px-1">
    <div class="min-w-0">
      <h3 class="text-sm font-semibold">{title}</h3>

      {#if description}
        <p class="text-xs text-base-content/60">{description}</p>
      {/if}
    </div>

    {@render aside?.()}
  </header>

  <div class="eris-card divide-y divide-base-content/10">
    {@render children()}
  </div>
</section>
