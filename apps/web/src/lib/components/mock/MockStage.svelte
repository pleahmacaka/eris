<script lang="ts">
  import type { Snippet } from "svelte"

  let { children }: { children: Snippet } = $props()
</script>

<div
  class={[
    "relative isolate flex min-h-80 flex-col overflow-hidden rounded-box",
    "border border-base-content/10 bg-base-200/70 px-4 py-8 select-none",
    "sm:min-h-96 sm:p-10",
  ]}
  aria-hidden="true"
>
  <div class="grid-lines absolute inset-0 -z-10 opacity-60"></div>
  {@render children()}
</div>
