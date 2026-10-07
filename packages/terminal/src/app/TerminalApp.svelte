<script lang="ts">
  import { shells } from "../pty"
  import { isSplit, neighbor } from "./layout"
  import PaneArea from "./PaneArea.svelte"
  import { prefs, savePrefs } from "./prefs.svelte"
  import SettingsDialog from "./SettingsDialog.svelte"
  import {
    closePane,
    cycleTab,
    openTab,
    session,
    splitPane,
  } from "./tabs.svelte"
  import TitleBar from "./TitleBar.svelte"
  import { newWindow, takeIntent } from "./windows"

  let { standalone = false }: { standalone?: boolean } = $props()

  const fallback = $derived(
    session.shells.find(shell => shell.id === prefs.shell)?.id ??
      session.shells[0]?.id ??
      "cmd",
  )

  const ARROWS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"] as const

  const paneShortcut = (e: KeyboardEvent) => {
    const tab = session.tabs[session.active]
    const alt = e.altKey && !e.ctrlKey && !e.metaKey

    if (!tab || !alt) {
      return false
    }

    if (e.shiftKey && (e.code === "Equal" || e.code === "Minus")) {
      splitPane(tab, e.code === "Equal" ? "right" : "bottom")

      return true
    }

    const arrow = ARROWS.find(key => key === e.key)

    if (e.shiftKey || !arrow || !isSplit(tab.root)) {
      return false
    }

    const next = neighbor(tab.root, tab.focus, arrow)

    if (next) {
      tab.focus = next.id
    }

    return !!next
  }

  const shortcut = (e: KeyboardEvent) => {
    if (paneShortcut(e)) {
      return true
    }

    const ctrl = e.ctrlKey && !e.altKey && !e.metaKey

    if (ctrl && e.code === "Tab") {
      cycleTab(e.shiftKey ? -1 : 1)

      return true
    }

    if (ctrl && e.code === "Comma") {
      session.settingsOpen = true

      return true
    }

    if (!ctrl || !e.shiftKey) {
      return false
    }

    if (e.code === "KeyT") {
      openTab(fallback)
    } else if (e.code === "KeyW") {
      const tab = session.tabs[session.active]

      if (tab) {
        closePane(tab.focus)
      }
    } else if (e.code === "KeyB") {
      const tab = session.tabs[session.active]

      if (tab) {
        tab.sync = !tab.sync
      }
    } else if (e.code === "KeyN") {
      newWindow()
    } else {
      return false
    }

    return true
  }

  const onkeydowncapture = (e: KeyboardEvent) => {
    if (shortcut(e)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  $effect(() => {
    Promise.all([shells(), takeIntent()]).then(([found, intent]) => {
      session.shells = found
      openTab(fallback, intent.cwd)
    })
  })

  $effect(() => {
    savePrefs(JSON.stringify(prefs))
  })
</script>

<svelte:window {onkeydowncapture} />

<div class="flex h-full min-h-0 flex-col">
  <TitleBar {fallback} />

  <PaneArea />
</div>

<SettingsDialog {fallback} {standalone} />
