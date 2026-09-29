<script lang="ts">
  import { icons as lucide } from "@iconify-json/lucide"
  import { addCollection } from "@iconify/svelte"
  import BottomNav from "$lib/components/ui/BottomNav.svelte"
  import Sidebar from "$lib/components/ui/Sidebar.svelte"
  import { device, watchDevice } from "$lib/settings.svelte"
  import { startAutoSync } from "$lib/sync/engine"
  import { applyAppearance } from "$lib/theme"
  import "./layout.css"

  const { children } = $props()

  addCollection(lucide)

  $effect(() => watchDevice())

  $effect(() => startAutoSync())

  $effect(() => {
    applyAppearance(device.value.appearance)
  })
</script>

<div class="flex h-dvh bg-base-200 text-base-content">
  <Sidebar />

  <div class="flex min-w-0 flex-1 flex-col">
    {@render children()}

    <BottomNav />
  </div>
</div>
