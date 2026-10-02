<script lang="ts">
  import type { Snippet } from "svelte"

  let { children }: { children: Snippet } = $props()
</script>

<span class="flex items-center gap-3 text-primary text-sm">
  <span class="size-1.5 shrink-0 bg-primary" aria-hidden="true"></span>
  {@render children()}
</span>
