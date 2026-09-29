<script lang="ts">
  import { onMount, untrack } from "svelte"
  import { fade } from "svelte/transition"
  import ContextMenu from "$lib/components/ui/ContextMenu.svelte"
  import { fieldMenu } from "$lib/menu/edit"
  import { showMenu } from "$lib/menu/menu.svelte"
  import { device } from "$lib/settings.svelte"
  import { onVaultChange, openVault, vault } from "$lib/vault/vault.svelte"
  import { closeActiveTab, newNote } from "$lib/workspace/commands"
  import {
    accept,
    drag,
    endDrag,
    payload,
  } from "$lib/workspace/drag.svelte"
  import {
    layout,
    movePanel,
    PANELS,
    type PanelId,
    persistLayout,
    restoreLayout,
    revealPanel,
  } from "$lib/workspace/layout.svelte"
  import {
    focusedPane,
    forget,
    openView,
    persistWorkspace,
    restoreWorkspace,
    splitPane,
    workspace,
  } from "$lib/workspace/workspace.svelte"
  import ActivityBar from "./ActivityBar.svelte"
  import Palette from "./Palette.svelte"
  import PaneView from "./PaneView.svelte"
  import SideBar from "./SideBar.svelte"
  import TitleBar from "./TitleBar.svelte"

  const SAVE_DELAY = 500

  let restored = $state(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  onMount(() => {
    Promise.all([restoreWorkspace(), restoreLayout()]).finally(
      () => (restored = true),
    )
  })

  const vaultPath = $derived(device.ready ? device.value.vault.path : undefined)

  $effect(() => {
    if (vaultPath !== undefined) {
      openVault(vaultPath)
    }
  })

  const prune = () => {
    const present = new Set(vault.entries.map(e => e.path))

    for (const pane of workspace.panes) {
      for (const tab of pane.tabs) {
        if (tab.path && !present.has(tab.path)) {
          forget(tab.path)
        }
      }
    }
  }

  $effect(() =>
    onVaultChange(change => {
      if (change.external) {
        prune()
      }
    }),
  )

  $effect(() => {
    if (vault.ready && vault.error === null && restored) {
      untrack(prune)
    }
  })

  $effect(() => {
    JSON.stringify([workspace, layout.docks, layout.actions, layout.width])

    if (!restored) {
      return
    }

    clearTimeout(timer)
    timer = setTimeout(() => {
      persistWorkspace().catch(() => undefined)
      persistLayout().catch(() => undefined)
    }, SAVE_DELAY)
  })

  const shortcuts: Record<string, () => unknown> = {
    p: () => (layout.palette = "commands"),
    o: () => (layout.palette = "files"),
    n: () => newNote(),
    w: closeActiveTab,
    b: () => (layout.open.left = !layout.open.left),
    "\\": () => splitPane(focusedPane()),
    ",": () => openView("settings"),
  }

  const keydown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    const command = event.ctrlKey || event.metaKey

    if (key === "f5" || (command && key === "r")) {
      event.preventDefault()

      return
    }

    if (!command || event.altKey) {
      return
    }

    if (key === "f" && !event.shiftKey) {
      const inEditor = (event.target as Element | null)?.closest(".cm-editor")

      if (!inEditor) {
        event.preventDefault()
        revealPanel("search")
      }

      return
    }

    if (event.shiftKey && key === "f") {
      event.preventDefault()
      revealPanel("search")

      return
    }

    const run = event.shiftKey ? undefined : shortcuts[key]

    if (run) {
      event.preventDefault()
      run()
    }
  }

  const dockRight = (event: DragEvent) => {
    const panel = payload(event, "panel") as PanelId

    if (panel in PANELS) {
      movePanel(panel, "right")
    }

    endDrag()
  }

  const nativeMenu = (event: MouseEvent) => {
    const items = fieldMenu(event.target)

    if (items) {
      showMenu(event, items)
    } else {
      event.preventDefault()
    }
  }

  const closePanels = () => {
    layout.open.left = false
    layout.open.right = false
  }
</script>

<svelte:window
  onkeydown={keydown}
  ondragend={endDrag}
  oncontextmenu={nativeMenu}
/>

<div class="flex h-dvh flex-col bg-base-200 text-base-content">
  <TitleBar />

  <div class="relative flex min-h-0 flex-1">
    <div class="flex max-lg:hidden">
      <ActivityBar />
    </div>

    <SideBar side="left" />

    <main class="flex min-h-0 min-w-0 flex-1 divide-x divide-base-content/10">
      {#each workspace.panes as pane (pane.id)}
        <PaneView {pane} />
      {/each}
    </main>

    <SideBar side="right" />

    {#if drag.kind === "panel" && !(layout.open.right && layout.docks.right.length > 0)}
      <div
        class={[
          "absolute inset-y-0 right-0 z-50 flex w-20 items-center justify-center",
          "border-l-2 border-dashed border-primary/60 bg-primary/10 text-xs",
          "text-primary",
        ]}
        role="region"
        aria-label="오른쪽 사이드바로 이동"
        ondragover={e => accept(e, "panel")}
        ondrop={dockRight}
      >
        [ → ]
      </div>
    {/if}

    {#if layout.open.left || layout.open.right}
      <button
        transition:fade={{ duration: 200 }}
        class="fixed inset-0 z-30 cursor-pointer bg-base-300/60 lg:hidden"
        aria-label="패널 닫기"
        onclick={closePanels}
      ></button>
    {/if}
  </div>

</div>

<Palette />
<ContextMenu />
