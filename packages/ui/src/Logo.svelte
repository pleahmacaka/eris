<script lang="ts">
  import { LOGO_VIEWBOX, logoParts } from "./logo"

  let { class: className = "" }: { class?: string } = $props()
</script>

<svg viewBox="0 0 {LOGO_VIEWBOX} {LOGO_VIEWBOX}" class={className} role="img" aria-label="Eris">
  {#each logoParts as p (p.part)}
    <path d={p.d} fill={p.color} />
  {/each}
</svg>
