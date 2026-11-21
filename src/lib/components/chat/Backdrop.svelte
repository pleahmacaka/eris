<script lang="ts">
import AsciiField from "#lib/components/brand/AsciiField.svelte"

let { strength = "full" }: { strength?: "full" | "faint" } = $props()
</script>

<AsciiField
  class={["absolute inset-0 -z-10 size-full", strength === "faint" && "opacity-50"]}
/>
<div
  class={["grid-lines absolute inset-0 -z-10", strength === "faint" ? "opacity-40" : "opacity-60"]}
  aria-hidden="true"
></div>
<div class="vignette absolute inset-0 -z-10" aria-hidden="true"></div>
