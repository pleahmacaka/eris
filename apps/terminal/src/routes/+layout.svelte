<script lang="ts">
  import { prefs } from "@eris/terminal"
  import { followEris, StandaloneShell } from "@eris/ui"
  import "virtual:iconify-subset"
  import "./layout.css"

  let { children } = $props()

  followEris(prefs)
</script>

<StandaloneShell>
  {@render children()}
</StandaloneShell>
