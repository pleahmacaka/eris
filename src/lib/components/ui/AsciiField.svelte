<script lang="ts">
  import { field } from "$lib/ascii/field"
  import { constellation } from "$lib/ascii/scenes"

  const { count = 22 }: { count?: number } = $props()
</script>

<canvas
  class="pointer-events-none absolute inset-0 size-full opacity-50"
  aria-hidden="true"
  {@attach field(constellation(count), { cell: 0.8, fps: 12 })}
></canvas>
