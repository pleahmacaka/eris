<script lang="ts">
  import { icons as lucide } from "@iconify-json/lucide"
  import { addCollection } from "@iconify/svelte"
  import { isTauri } from "$lib/platform/runtime"
  import { device, watchDevice } from "$lib/settings.svelte"
  import { startAutoSync } from "$lib/sync/engine"
  import { applyAppearance } from "$lib/theme"
  import "./layout.css"

  const { children } = $props()

  addCollection(lucide)

  $effect(() => watchDevice())

  $effect(() => (isTauri() ? startAutoSync() : undefined))

  $effect(() => {
    applyAppearance(device.value.appearance)
  })
</script>

{@render children()}
