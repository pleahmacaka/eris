<script lang="ts">
  import { addCollection } from "@iconify/svelte"
  import favicon from "$lib/assets/favicon.svg"
  import { lucideSubset } from "$lib/icons"
  import {
    type Appearance,
    defaultAppearance,
    loadProfile,
    onProfile,
  } from "$lib/settings"
  import { applyAppearance } from "$lib/theme"
  import Aura from "$lib/ui/Aura.svelte"
  import GlobalContextMenu from "$lib/ui/GlobalContextMenu.svelte"
  import "./layout.css"

  let { children } = $props()

  addCollection(lucideSubset)

  $effect(() => {
    let current: Appearance = defaultAppearance
    const scheme = window.matchMedia("(prefers-color-scheme: dark)")

    const apply = (appearance: Appearance) => {
      current = appearance
      applyAppearance(current)
    }

    const onScheme = () => {
      if (current.mode === "system") {
        applyAppearance(current)
      }
    }

    loadProfile().then(p => apply(p.appearance))

    const stop = onProfile(p => apply(p.appearance))

    scheme.addEventListener("change", onScheme)

    return () => {
      stop.then(unlisten => unlisten())
      scheme.removeEventListener("change", onScheme)
    }
  })
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="siri-shell">
  <Aura />

  {@render children()}
</div>

<GlobalContextMenu />
