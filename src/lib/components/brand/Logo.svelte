<script lang="ts">
import { LOGO_VIEWBOX, logoParts } from "#lib/brand/logo.js"

type Props = { class?: string; mono?: boolean }

let { class: className = "", mono = false }: Props = $props()
</script>

<svg
  viewBox="0 0 {LOGO_VIEWBOX} {LOGO_VIEWBOX}"
  class={className}
  role="img"
  aria-label="Eris"
>
  {#each logoParts as p (p.part)}
    <path
      d={p.d}
      style:fill={mono ? "currentColor" : `var(--color-${p.token})`}
      fill-opacity={mono && p.part === "blade" ? 0.7 : undefined}
    />
  {/each}
</svg>
