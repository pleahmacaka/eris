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
  import GlobalContextMenu from "$lib/ui/GlobalContextMenu.svelte"
  import "./layout.css"

  let { children } = $props()

  addCollection(lucideSubset)

  const orbs = [
    { x: "18%", y: "24%", size: "46vmax", offset: 0, depth: "-9rem", glow: 0.85, travel: "7%", dur: "19s", delay: "0s" },
    { x: "78%", y: "18%", size: "40vmax", offset: 65, depth: "-5.6rem", glow: 0.8, travel: "9%", dur: "23s", delay: "-6s" },
    { x: "70%", y: "80%", size: "44vmax", offset: 120, depth: "-2.5rem", glow: 0.75, travel: "8%", dur: "17s", delay: "-3s" },
    { x: "24%", y: "76%", size: "36vmax", offset: -180, depth: "1.25rem", glow: 0.7, travel: "6%", dur: "27s", delay: "-11s" },
    { x: "50%", y: "50%", size: "28vmax", offset: -55, depth: "5rem", glow: 0.55, travel: "11%", dur: "13s", delay: "-8s" },
  ]

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
  <div aria-hidden="true" class="siri-aura">
    {#each orbs as o (o.offset)}
      <div
        class="siri-orb"
        style="--x:{o.x}; --y:{o.y}; --size:{o.size}; --offset:{o.offset}; --depth:{o.depth}; --glow:{o.glow}; --travel:{o.travel}; --dur:{o.dur}; --delay:{o.delay}"
      ></div>
    {/each}

    <div class="siri-veil"></div>

    <div class="siri-grain"></div>
  </div>

  {@render children()}
</div>

<GlobalContextMenu />
