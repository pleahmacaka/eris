<script lang="ts">
  import type { Snippet } from "svelte"

  let {
    title,
    description,
    children,
  }: { title: string; description?: string; children: Snippet } = $props()
</script>

<section data-group={title} class="eris-card scroll-mt-16">
  <header class="px-4 pt-4 pb-1.5">
    <h3 class="text-sm font-semibold">{title}</h3>

    {#if description}
      <p class="text-xs text-base-content/60">{description}</p>
    {/if}
  </header>

  <div class="divide-y divide-base-content/10">
    {@render children()}
  </div>
</section>
