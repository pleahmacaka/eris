<script lang="ts">
  import { addCollection } from "@iconify/svelte"
  import { prefs } from "@eris/terminal"
  import { Aura, followEris, GlobalContextMenu, Toasts } from "@eris/ui"
  import icons from "virtual:iconify-subset"
  import "./layout.css"

  let { children } = $props()

  for (const collection of icons) {
    addCollection(collection)
  }
  followEris(prefs)
</script>

<div class="siri-shell">
  <Aura />

  {@render children()}
</div>

<GlobalContextMenu />

<Toasts />
