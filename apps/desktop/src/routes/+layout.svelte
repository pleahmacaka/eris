<script lang="ts">
  import { addCollection } from "@iconify/svelte"
  import { logoSvg } from "@eris/ui/logo"
  import { lucideSubset } from "$lib/icons"
  import { setupI18n } from "@eris/i18n"
  import {
    type Appearance,
    defaultAppearance,
    loadDevice,
    loadProfile,
    onDevice,
    onProfile,
    type WindowSurface,
  } from "@eris/settings"
  import { applyAppearance } from "$lib/theme"
  import { fadeShell } from "$lib/motion"
  import { page } from "$app/state"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { Aura, GlobalContextMenu } from "@eris/ui"
  import {
    onWindowHiding,
    onWindowShown,
    type WindowLabel,
  } from "$lib/native"
  import "./layout.css"

  let { children } = $props()

  addCollection(lucideSubset)

  const WINDOWS: Record<string, WindowSurface> = {
    "": "launcher",
    panel: "panel",
    settings: "settings",
    notices: "notices",
    files: "files",
    terminal: "terminal",
  }

  const favicon = `data:image/svg+xml,${encodeURIComponent(logoSvg())}`

  const surface = WINDOWS[page.route.id?.split("/")[1] ?? ""]

  if (surface) {
    document.documentElement.dataset.window = surface
  }

  const appWindow = getCurrentWindow()
  const windowLabel = appWindow.label as WindowLabel
  const framed = page.data.framed === true

  $effect(() => {
    if (framed) {
      appWindow.show().then(() => appWindow.setFocus())
    }
  })

  $effect(() => {
    let current: Appearance = defaultAppearance
    const scheme = window.matchMedia("(prefers-color-scheme: dark)")

    const apply = (appearance: Appearance) => {
      current = appearance
      applyAppearance(current, { restingShadow: framed })
    }

    const onScheme = () => {
      if (current.mode === "system") {
        applyAppearance(current, { restingShadow: framed })
      }
    }

    loadProfile().then(p => apply(p.appearance))
    loadDevice().then(d => setupI18n(d.language))

    const fade = (out: boolean) => {
      if (!framed) {
        fadeShell(out)
      }
    }

    fade(false)

    const stops = [
      onProfile(p => apply(p.appearance)),
      onDevice(d => setupI18n(d.language)),
      onWindowShown(windowLabel, () => fade(false)),
      onWindowHiding(windowLabel, () => fade(true)),
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

<svelte:head><link rel="icon" type="image/svg+xml" href={favicon} /></svelte:head>

<div class="siri-shell">
  <Aura />

  {@render children()}
</div>

<GlobalContextMenu dense={page.data.denseMenu === true} />
