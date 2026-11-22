<script lang="ts">
import type { Snippet } from "svelte"

let { title, children }: { title: string; children: Snippet } = $props()
</script>

<section
  class="flex flex-col gap-4 rounded-box border border-base-content/10 bg-base-100/50 p-6"
>
  <h2 class="font-bold">{title}</h2>
  {@render children()}
</section>
