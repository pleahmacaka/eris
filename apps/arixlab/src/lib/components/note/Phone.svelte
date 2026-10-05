<script lang="ts">
import type { ClassValue } from "svelte/elements"
import type { Shot } from "$lib/data/note"

let {
  shot,
  alt,
  class: classes,
}: { shot: Shot; alt: string; class?: ClassValue } = $props()
</script>

<figure
  class={[
    "rounded-[1.75rem] border border-base-300 bg-base-300/50 p-1.5",
    "shadow-2xl shadow-black/60",
    classes,
  ]}
>
  <img
    class="block h-auto w-full rounded-[1.4rem]"
    src={shot.src}
    width={shot.width}
    height={shot.height}
    {alt}
    loading="lazy"
    decoding="async"
  />
</figure>
