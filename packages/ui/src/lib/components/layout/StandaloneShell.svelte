<script lang="ts">
  import type { Snippet } from "svelte"
  import Aura from "../appearance/Aura.svelte"
  import Toasts from "../feedback/Toasts.svelte"
  import GlobalContextMenu from "../menus/GlobalContextMenu.svelte"

  let {
    children,
    dense = false,
  }: { children: Snippet; dense?: boolean } = $props()
</script>

<div class="siri-shell">
  <Aura />

  {@render children()}
</div>

<GlobalContextMenu {dense} />

<Toasts />
