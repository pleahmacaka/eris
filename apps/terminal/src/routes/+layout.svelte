<script lang="ts">
  import { addCollection } from "@iconify/svelte"
  import { prefs } from "@eris/terminal"
  import { Aura, followEris, GlobalContextMenu, Toasts } from "@eris/ui"
  import { lucideSubset } from "$lib/icons"
  import "./layout.css"

  let { children } = $props()

  addCollection(lucideSubset)
  followEris(prefs)
</script>

<div class="siri-shell">
  <Aura />

  {@render children()}
</div>

<GlobalContextMenu />

<Toasts />
