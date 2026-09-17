<script lang="ts">
  import { untrack } from "svelte"
  import { listen } from "@tauri-apps/api/event"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { ensureDevice } from "$lib/device"
  import { DockLayout } from "$lib/dock"
  import LeadWidgets from "$lib/dock/LeadWidgets.svelte"
  import Tray from "$lib/dock/Tray.svelte"
  import * as native from "$lib/native"
  import { onDevice, type DeviceSettings } from "@eris/settings"

  document.documentElement.dataset.surface = "dock"

  const layout = new DockLayout("topbar")

  let device = $state<DeviceSettings>(layout.device)
  let panelOpen = $state(false)

  const trayClaim = layout.claimFor

  const on = $derived(device.features.dock && device.topBar)

  const sync = async (next: DeviceSettings) => {
    device = next

    if (!next.features.dock || !next.topBar) {
      await native.releaseTopbar().catch(() => undefined)

      return
    }

    layout.device = next
    await layout.applyLayout()
    await native.showWindow("topbar").catch(() => undefined)
  }

  const togglePanel = () => native.toggleWindow("panel").catch(() => undefined)

  $effect(() => {
    const box = layout.menuBox

    native
      .extendTopbar(
        0,
        box ? [box.left, box.top, box.right, box.bottom] : null,
      )
      .catch(() => undefined)
  })

  $effect(() => {
    ensureDevice().then(sync)

    const stops = [
      onDevice(d => {
        void sync(d)
      }),
      native.onWindowShown("panel", () => {
        panelOpen = true
      }),
      native.onWindowHiding("panel", () => {
        panelOpen = false
      }),
      native.onDockFullscreen(fullscreen => {
        if (fullscreen) {
          layout.closeMenus()
        }
      }),
      listen("eris-close-menus", () => {
        layout.closeLocal()
      }),
      getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (!focused) {
          layout.closeMenus()
        }
      }),
    ]

    return () => {
      for (const stop of stops) {
        stop.then(fn => fn())
      }
    }
  })

  $effect(() => {
    void layout.staticKey

    if (on) {
      untrack(layout.applyLayout)
    }
  })
</script>

{#if on}
  <div
    class="flex h-(--dock-height) items-center gap-1 border-b border-base-content/10 bg-base-100 px-2"
  >
    <div class="flex items-center gap-1">
      <LeadWidgets {layout} edge="top" compact={true} />
    </div>

    <div class="ml-auto flex items-center">
      <Tray
        {device}
        {panelOpen}
        onclock={togglePanel}
        claimFor={trayClaim}
        edge="top"
        compact={true}
      />
    </div>
  </div>
{/if}
