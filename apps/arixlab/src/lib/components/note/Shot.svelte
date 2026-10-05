<script lang="ts">
import type { ClassValue } from "svelte/elements"
import type { Shot } from "$lib/data/note"

let {
  shot,
  alt,
  eager = false,
  class: classes,
}: { shot: Shot; alt: string; eager?: boolean; class?: ClassValue } = $props()
</script>

<figure class={["hud bg-base-200/80 p-1.5 sm:p-2", classes]}>
  <img
    class="block h-auto w-full border border-base-300"
    src={shot.src}
    width={shot.width}
    height={shot.height}
    {alt}
    loading={eager ? "eager" : "lazy"}
    decoding="async"
  />
</figure>
