<script lang="ts">
  import { prefs } from "@eris/files"
  import { followEris, StandaloneShell } from "@eris/ui"
  import "virtual:iconify-subset"
  import "./layout.css"

  let { children } = $props()

  followEris(prefs)
</script>

<StandaloneShell dense>
  {@render children()}
</StandaloneShell>
