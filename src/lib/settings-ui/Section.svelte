<script lang="ts">
  import type { Snippet } from "svelte"

  let {
    title,
    description,
    children,
  }: { title: string; description?: string; children: Snippet } = $props()
</script>

<section
  class="rounded-box border border-base-content/10 bg-base-100/60 shadow-sm backdrop-blur-md"
>
  <header class="px-4 pt-3 pb-1">
    <h3 class="text-sm font-semibold">{title}</h3>

    {#if description}
      <p class="text-xs text-base-content/60">{description}</p>
    {/if}
  </header>

  <div class="divide-y divide-base-content/10">
    {@render children()}
  </div>
</section>
