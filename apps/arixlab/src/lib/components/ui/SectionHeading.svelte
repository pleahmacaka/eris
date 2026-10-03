<script lang="ts">
import { reveal } from "$lib/motion/reveal"
import { scramble } from "$lib/motion/scramble"

let { index, title }: { index: number; title: string } = $props()

const label = $derived(String(index).padStart(2, "0"))
</script>

<div class="flex items-center gap-4" data-reveal use:reveal>
  <span class="text-primary text-sm tabular-nums">{label}</span>

  <h2
    class="font-medium text-base-content/85 text-sm"
    use:scramble={{ onView: true, duration: 520 }}
  >
    {title}
  </h2>

  <span class="flex-1 border-base-300 border-t"></span>

  <span class="flex gap-1" aria-hidden="true">
    <span class="size-1 bg-primary"></span>
    <span class="size-1 bg-base-300"></span>
    <span class="size-1 bg-base-300"></span>
  </span>
</div>
