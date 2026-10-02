<script lang="ts">
  import type { Snippet } from "svelte"
  import { shells } from "../pty"
  import Terminal from "../Terminal.svelte"
  import { prefs, savePrefs } from "./prefs.svelte"
  import SettingsDialog from "./SettingsDialog.svelte"
  import { closeTab, cycleTab, openTab, session } from "./tabs.svelte"
  import TitleBar from "./TitleBar.svelte"
  import { newWindow, takeIntent } from "./windows"

  let { theme }: { theme?: Snippet } = $props()

  const fallback = $derived(
    session.shells.find(shell => shell.id === prefs.shell)?.id ??
      session.shells[0]?.id ??
      "cmd",
  )

  const shortcut = (e: KeyboardEvent) => {
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
      closeTab(session.active)
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

  <main class="relative min-h-0 grow bg-base-100">
    {#each session.tabs as tab, index (tab.id)}
      <div
        class={[
          "absolute inset-0 py-1.5 pl-3 pr-1",
          index !== session.active && "invisible",
        ]}
      >
        <Terminal
          shell={tab.shell}
          cwd={tab.cwd}
          fontFamily={prefs.fontFamily}
          fontSize={prefs.fontSize}
          active={index === session.active}
          ontitle={title => (tab.title = title || tab.title)}
          onexit={() => {
            const index = session.tabs.indexOf(tab)

            if (index >= 0) {
              closeTab(index)
            }
          }}
        />
      </div>
    {/each}
  </main>
</div>

<SettingsDialog {fallback} {theme} />
