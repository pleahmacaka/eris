<script lang="ts">
import type { ClassValue } from "svelte/elements"
import { WORDMARK } from "#lib/brand/wordmark.js"

let { class: className }: { class?: ClassValue } = $props()
</script>

<svg
  viewBox="0 0 {WORDMARK.width} {WORDMARK.height}"
  class={["fill-current", className]}
  aria-hidden="true"
>
  <path d={WORDMARK.d} />
</svg>
