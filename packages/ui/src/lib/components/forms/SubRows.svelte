<script lang="ts">
  import type { Snippet } from "svelte"
  import { slide } from "svelte/transition"

  let { open, children }: { open: boolean; children: Snippet } = $props()
</script>

{#if open}
  <div transition:slide={{ duration: 140 }} class="bg-base-content/3">
    <div class="ml-5 divide-y divide-base-content/10 border-l-2 border-primary/25">
      {@render children()}
    </div>
  </div>
{/if}
