<script lang="ts">
  import { addCollection } from "@iconify/svelte"
  import { applyAppearance, standaloneLook } from "@eris/settings"
  import { StandaloneShell } from "@eris/ui"
  import icons from "virtual:iconify-subset"
  import "./layout.css"

  let { children } = $props()

  for (const collection of icons) {
    addCollection(collection)
  }

  $effect(() => {
    applyAppearance(standaloneLook, { restingShadow: true })
  })
</script>

<StandaloneShell>
  {@render children()}
</StandaloneShell>
