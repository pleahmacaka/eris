<script lang="ts">
  import { prefs } from "@eris/files"
  import { followEris, StandaloneShell } from "@eris/ui"
  import { page } from "$app/state"
  import "virtual:iconify-subset"
  import "./layout.css"

  let { children } = $props()

  followEris(prefs, { reveal: page.route.id !== "/menu" })
</script>

<StandaloneShell dense>
  {@render children()}
</StandaloneShell>
