<script lang="ts">
  import { contextMenu } from "@eris/ui"
  import { getCurrentWebview } from "@tauri-apps/api/webview"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import type { Snippet } from "svelte"
  import { t } from "svelte-i18n"
  import { isAudio } from "../filetypes"
  import { isVirtual, parentOf } from "../locations"
  import { BINDINGS, comboOf, runCommand } from "../store/commands"
  import type { Explorer } from "../store/explorer.svelte"
  import { openMenu } from "../store/menus"
  import { prefs } from "../store/prefs.svelte"
  import { terminalPrefs } from "../store/terminal.svelte"
  import AudioView from "./audio/AudioView.svelte"
  import ItemsView from "./items/ItemsView.svelte"
  import PreviewPane from "./panes/PreviewPane.svelte"
  import StatusBar from "./panes/StatusBar.svelte"
  import SettingsDialog from "./settings/SettingsDialog.svelte"
  import SharedView from "./share/SharedView.svelte"
  import ShareHost from "./share/ShareHost.svelte"
  import NavPane from "./sidebar/NavPane.svelte"
  import TerminalPanel from "./terminal/TerminalPanel.svelte"
  import CommandBar from "./toolbar/CommandBar.svelte"
  import NavBar from "./toolbar/NavBar.svelte"
  import TitleBar from "./window/TitleBar.svelte"

  let { explorer, theme }: { explorer: Explorer; theme?: Snippet } = $props()

  const current = getCurrentWindow()

  let view = $state<ReturnType<typeof ItemsView>>()
  let nav = $state<ReturnType<typeof NavBar>>()

  const tab = $derived(explorer.tab)

  const preview = $derived(
    explorer.selected.length === 1 ? explorer.selected[0] : null,
  )

  const busy = () => contextMenu.request !== null || explorer.settingsOpen

  const keyboardMenu = () => {
    const focus = tab.focus
    const row = focus
      ? document.querySelector(`[data-key="${CSS.escape(focus)}"]`)
      : null
    const box = row?.getBoundingClientRect()
    const x = box ? box.left + box.width / 4 : window.innerWidth / 2
    const y = box ? box.bottom : window.innerHeight / 2
    const item = explorer.selected[0] ?? null

    openMenu(
      explorer,
      new MouseEvent("contextmenu", { clientX: x, clientY: y }),
      item,
    )
  }

  const FOCUS: Record<string, () => void> = {
    "Ctrl+F": () => nav?.focusSearch(),
    "Ctrl+E": () => nav?.focusSearch(),
    F3: () => nav?.focusSearch(),
    "Ctrl+L": () => nav?.editAddress(),
    "Alt+D": () => nav?.editAddress(),
    F4: () => nav?.editAddress(),
  }

  const LOCAL: Record<string, () => unknown> = {
    Escape: () => (tab.results ? tab.clearSearch() : tab.select([])),
    "Shift+F10": keyboardMenu,
    ContextMenu: keyboardMenu,
    "Ctrl+Space": () => tab.focus && tab.toggle(tab.focus),
  }

  const onkeydowncapture = (e: KeyboardEvent) => {
    const id = BINDINGS.capture.get(comboOf(e))

    if (id) {
      e.preventDefault()
      e.stopPropagation()
      runCommand(id, explorer)
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey

    if (e.key === "F5" || (ctrl && (e.code === "KeyR" || e.code === "KeyP"))) {
      e.preventDefault()
    }

    if (busy()) {
      return
    }

    const combo = comboOf(e)
    const typing = !!(e.target as HTMLElement | null)?.closest(
      "input, textarea, select",
    )

    const handle = (run: () => unknown) => {
      e.preventDefault()
      run()
    }

    const global = BINDINGS.global.get(combo)

    if (global) {
      return handle(() => runCommand(global, explorer))
    }

    if (FOCUS[combo]) {
      return handle(FOCUS[combo])
    }

    if (typing || e.altKey) {
      return
    }

    const local = BINDINGS.local.get(combo)

    if (local) {
      return handle(() => runCommand(local, explorer))
    }

    if (LOCAL[combo]) {
      return handle(LOCAL[combo])
    }

    if (view?.navigate(e)) {
      e.preventDefault()
    }
  }

  const sideButton = (e: MouseEvent) => e.button === 3 || e.button === 4

  const onmousedown = (e: MouseEvent) => {
    if (sideButton(e)) {
      e.preventDefault()
    }
  }

  const onmouseup = (e: MouseEvent) => {
    if (!sideButton(e)) {
      return
    }

    e.preventDefault()

    if (busy()) {
      return
    }

    if (e.button === 3) {
      tab.back()
    } else {
      tab.forward()
    }
  }

  const folderAt = (position: { x: number; y: number }) => {
    const scale = window.devicePixelRatio
    const zone = document
      .elementFromPoint(position.x / scale, position.y / scale)
      ?.closest<HTMLElement>("[data-drop-path], [data-key]")
    const path =
      zone?.dataset.dropPath ??
      explorer.visible.find(item => item.dir && item.key === zone?.dataset.key)
        ?.key

    return path && !isVirtual(path) ? path : null
  }

  $effect(() => {
    current
      .setTitle(`${explorer.title(tab, $t)} - Eris Files`)
      .catch(() => undefined)
  })

  $effect(() => {
    const stops = [
      current.listen<string>("dir-changed", e => {
        const id = Number(e.payload)

        explorer.tabs.find(entry => entry.id === id)?.changed()
      }),
      getCurrentWebview().onDragDropEvent(e => {
        const { payload } = e

        if (payload.type === "leave") {
          explorer.dropKey = null

          return
        }

        const target = folderAt(payload.position)

        explorer.dropKey = target

        if (payload.type === "drop") {
          explorer.dropKey = null
          explorer.drop(payload.paths, target)
        }
      }),
    ]

    return () => {
      for (const stop of stops) {
        stop.then(unlisten => unlisten())
      }
    }
  })
</script>

<svelte:window {onkeydown} {onkeydowncapture} {onmousedown} {onmouseup} />

<div class="flex h-full min-h-0 flex-col select-none">
  <TitleBar {explorer} />

  <div class="flex min-h-0 grow flex-col bg-base-100/70">
    <NavBar bind:this={nav} {explorer} />

    <CommandBar {explorer} />

    <div
      class={[
        "flex min-h-0 grow",
        terminalPrefs.position === "side" ? "flex-row" : "flex-col",
      ]}
    >
      <div class="flex min-h-0 min-w-0 grow">
        <NavPane {explorer} />

        {#if tab.kind === "audio"}
          {#key tab.location}
            <AudioView path={tab.location} />
          {/key}
        {:else if tab.kind === "shared"}
          <SharedView
            folder={tab.history.findLast(
              entry => !isVirtual(entry) && !isAudio(entry),
            ) ?? null}
            reveal={path => explorer.go(parentOf(path) ?? path, path)}
          />
        {:else}
          <ItemsView bind:this={view} {explorer} />
        {/if}

        {#if prefs.preview}
          <PreviewPane item={preview} />
        {/if}
      </div>

      <TerminalPanel {explorer} />
    </div>

    <StatusBar {explorer} />
  </div>
</div>

<SettingsDialog bind:open={explorer.settingsOpen} {theme} />

<ShareHost {explorer} />
