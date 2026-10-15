<script lang="ts">
  import { applyAppearance, standaloneLook } from "@eris/settings"
  import { StandaloneShell } from "@eris/ui"
  import "virtual:iconify-subset"
  import "./layout.css"

  let { children } = $props()

  $effect(() => {
    applyAppearance(standaloneLook, { restingShadow: true })
  })
</script>

<StandaloneShell>
  {@render children()}
</StandaloneShell>
