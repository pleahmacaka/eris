<script lang="ts">
import type { ClassValue } from "svelte/elements"
import { TOKEN_FILL } from "#lib/brand/fill.js"
import { LOGO_VIEWBOX, logoParts } from "#lib/brand/logo.js"

type Props = { class?: ClassValue; mono?: boolean }

let { class: className, mono = false }: Props = $props()
</script>

<svg
  viewBox="0 0 {LOGO_VIEWBOX} {LOGO_VIEWBOX}"
  class={className}
  role="img"
  aria-label="Eris"
>
  {#each logoParts as part (part.part)}
    <path d={part.d} class={mono ? "fill-current" : TOKEN_FILL[part.token]} />
  {/each}
</svg>
