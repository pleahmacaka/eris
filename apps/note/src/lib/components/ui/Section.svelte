<script lang="ts">
  import type { Snippet } from "svelte"
  import { scramble } from "$lib/ascii/scramble"

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

<section class="mb-8 flex flex-col gap-3">
  <div class="flex items-center gap-3">
    <h2 class="shrink-0 text-sm font-medium text-base-content/60">
      <span class="text-primary/70" aria-hidden="true">//</span>
      <span use:scramble={{ onView: true, duration: 520 }}>{title}</span>
    </h2>

    <span class="flex-1 border-t border-base-content/10"></span>

    {#if aside}
      {@render aside()}
    {/if}
  </div>

  {#if hint}
    <p class="-mt-1 text-xs text-base-content/50">{hint}</p>
  {/if}

  {@render children()}
</section>
