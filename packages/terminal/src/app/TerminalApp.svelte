<script lang="ts">
  import { sessionShortcut } from "./keys"
  import PaneArea from "./PaneArea.svelte"
  import { prefs, savePrefs } from "./prefs.svelte"
  import SettingsDialog from "./SettingsDialog.svelte"
  import { adoptTab, loadShells, openTab, session } from "./tabs.svelte"
  import TitleBar from "./TitleBar.svelte"
  import { newWindow, takeIntent } from "./windows"

  let { standalone = false }: { standalone?: boolean } = $props()

  const shortcut = (e: KeyboardEvent) => {
    if (sessionShortcut(e)) {
      return true
    }

    const ctrl = e.ctrlKey && !e.altKey && !e.metaKey

    if (ctrl && e.code === "Comma") {
      session.settingsOpen = true

      return true
    }

    if (ctrl && e.shiftKey && e.code === "KeyN") {
      newWindow()

      return true
    }

    return false
  }

  const onkeydowncapture = (e: KeyboardEvent) => {
    if (shortcut(e)) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  $effect(() => {
    Promise.all([loadShells(), takeIntent()]).then(([, intent]) => {
      if (intent.handoff) {
        adoptTab(intent.handoff)
      } else {
        openTab({ cwd: intent.cwd })
      }
    })
  })

  $effect(() => {
    savePrefs(JSON.stringify(prefs))
  })
</script>

<svelte:window {onkeydowncapture} />

<div class="flex h-full min-h-0 flex-col">
  <TitleBar />

  <PaneArea fontFamily={prefs.fontFamily} fontSize={prefs.fontSize} />
</div>

<SettingsDialog {standalone} />
