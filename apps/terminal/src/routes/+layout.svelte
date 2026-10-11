<script lang="ts">
  import { addCollection } from "@iconify/svelte"
  import { prefs } from "@eris/terminal"
  import { followEris, StandaloneShell } from "@eris/ui"
  import icons from "virtual:iconify-subset"
  import "./layout.css"

  let { children } = $props()

  for (const collection of icons) {
    addCollection(collection)
  }
  followEris(prefs)
</script>

<StandaloneShell>
  {@render children()}
</StandaloneShell>
