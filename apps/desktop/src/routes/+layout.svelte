<script lang="ts">
  import { addCollection } from "@iconify/svelte"
  import favicon from "$lib/assets/favicon.svg"
  import { lucideSubset } from "$lib/icons"
  import { setupI18n } from "@eris/i18n"
  import {
    type Appearance,
    defaultAppearance,
    loadDevice,
    loadProfile,
    onDevice,
    onProfile,
  } from "@eris/settings"
  import { applyAppearance } from "$lib/theme"
  import { Aura, GlobalContextMenu } from "@eris/ui"
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
    loadDevice().then(d => setupI18n(d.language))

    const stops = [
      onProfile(p => apply(p.appearance)),
      onDevice(d => setupI18n(d.language)),
    ]

    scheme.addEventListener("change", onScheme)

    return () => {
      for (const stop of stops) {
        stop.then(unlisten => unlisten())
      }

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
