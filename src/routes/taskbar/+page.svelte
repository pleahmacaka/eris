<script lang="ts">
  import Icon from "@iconify/svelte"
  import { listen } from "@tauri-apps/api/event"
  import { untrack } from "svelte"
  import {
    getCurrentWindow,
    PhysicalPosition,
    PhysicalSize,
    Window,
  } from "@tauri-apps/api/window"
  import { live } from "$lib/data/live.svelte"
  import { scheduleReminders } from "$lib/data/reminders"
  import { events } from "$lib/data/store"
  import { ensureDevice } from "$lib/device"
  import {
    dock,
    dockAwake,
    groupWindows,
    resolvePins,
    startDock,
  } from "$lib/dock/dock.svelte"
  import DockItem from "$lib/dock/DockItem.svelte"
  import Tray from "$lib/dock/Tray.svelte"
  import { startTimerWatch } from "$lib/launcher/timers"
  import * as native from "$lib/native"
  import {
    type DeviceSettings,
    defaultDevice,
    defaultProfile,
    loadProfile,
    onDevice,
    onProfile,
    type Profile,
  } from "$lib/settings"
  import { startAutoSync } from "$lib/sync/engine"

  const STRIP = 6
  const HIDE_DELAY = 1_200
  const VISIBILITY_POLL = 2_000
  const REOPEN_GUARD = 400

  let device = $state<DeviceSettings>(defaultDevice)
  let profile = $state<Profile>(defaultProfile)
  let ready = $state(false)
  let hovered = $state(false)
  let edgeHover = $state(false)
  let held = $state(false)
  let panelOpen = $state(false)
  let collapsed = $state(false)
  let dockHidden = $state(false)
  let pageHidden = $state(false)
  let menuHeight = $state(0)
  let hiddenAt = 0

  const eventLive = live(events)

  const mac = $derived(device.dockStyle === "mac")

  const foreground = $derived(dock.windows[0]?.hwnd)

  const hotkey = $derived(
    `${device.launcherTrigger}|${device.launcherShortcut}`,
  )

  const layoutKey = $derived(
    [
      device.dockStyle,
      device.dockEdge,
      device.dockHeight,
      device.dockWidth,
      device.dockAutoHide,
      device.hideSystemTaskbar,
      device.dockMonitor,
      collapsed,
    ].join("|"),
  )

  const groups = $derived(
    groupWindows(
      dock.pinned,
      resolvePins(device.pinnedApps, dock.apps),
      dock.windows,
    ).filter(g => g.pinned || device.showRunningApps),
  )

  const applyLayout = () => {
    if (dockHidden) {
      return Promise.resolve(undefined)
    }

    const root = document.documentElement

    root.dataset.dock = device.dockStyle
    root.dataset.edge = device.dockEdge
    root.style.setProperty("--dock-height", `${device.dockHeight}px`)

    return native
      .applyTaskbar({
        edge: device.dockEdge,
        height: collapsed ? STRIP : device.dockHeight,
        width: device.dockWidth,
        floating: mac,
        autoHide: device.dockAutoHide,
        hideSystemTaskbar: device.hideSystemTaskbar,
        monitor: device.dockMonitor,
      })
      .catch(() => undefined)
  }

  const extend = async (px: number) => {
    menuHeight = px

    if (px === 0) {
      return applyLayout()
    }

    const win = getCurrentWindow()
    const [scale, position, size] = await Promise.all([
      win.scaleFactor(),
      win.outerPosition(),
      win.outerSize(),
    ])
    const extra = Math.round(px * scale)
    const y = device.dockEdge === "top" ? position.y : position.y - extra

    await win.setPosition(new PhysicalPosition(position.x, y))
    await win.setSize(new PhysicalSize(size.width, size.height + extra))
  }

  const refreshVisibility = async () => {
    const [panel, launcher] = await Promise.all(
      (["panel", "main"] as const).map(async label => {
        const win = await Window.getByLabel(label)

        return (await win?.isVisible().catch(() => false)) ?? false
      }),
    )

    panelOpen = panel
    held = panel || launcher
  }

  const togglePanel = async () => {
    if (Date.now() - hiddenAt < REOPEN_GUARD) {
      return
    }

    await applyLayout()

    if (panelOpen) {
      panelOpen = false
      await native.hideWindow("panel")
    } else {
      panelOpen = true
      await native.showWindow("panel")
    }
  }

  $effect(() => {
    ensureDevice().then(d => {
      device = d
      ready = true
    })
    loadProfile().then(p => {
      profile = p
    })

    const stops = [
      onDevice(d => {
        device = d
      }),
      onProfile(p => {
        profile = p
      }),
      native.onWindowShown("panel", refreshVisibility),
      native.onWindowShown("main", refreshVisibility),
      listen<string>("window-hidden", e => {
        if (e.payload === "panel") {
          hiddenAt = Date.now()
        }

        refreshVisibility()
      }),
      native.onDockEdge(atEdge => {
        edgeHover = atEdge
      }),
      listen<{ visible: boolean }>("dock-visible", e => {
        dockHidden = !e.payload.visible

        if (dockHidden) {
          hovered = false
          edgeHover = false
          menuHeight = 0
        } else {
          untrack(applyLayout)
        }
      }),
      native.onDockFullscreen(fullscreen => {
        if (fullscreen) {
          menuHeight = 0
        }
      }),
    ]
    const stopSync = startAutoSync()
    const stopDock = startDock()
    const stopTimers = startTimerWatch()
    const poll = setInterval(refreshVisibility, VISIBILITY_POLL)

    refreshVisibility()

    return () => {
      stopSync()
      stopDock()
      stopTimers()
      clearInterval(poll)

      for (const stop of stops) {
        stop.then(fn => fn())
      }

      eventLive.stop()
    }
  })

  $effect(() => {
    void layoutKey

    if (ready) {
      untrack(applyLayout)
    }
  })

  $effect(() => {
    if (!ready) {
      return
    }

    const [trigger, shortcut] = hotkey.split("|")

    native
      .setLauncherShortcut(trigger === "win" ? null : shortcut)
      .catch(() => undefined)
    native.setWinKeyCapture(trigger !== "shortcut").catch(() => undefined)
  })

  $effect(() => {
    if (!ready || dockHidden) {
      return
    }

    if (
      !device.dockAutoHide ||
      hovered ||
      edgeHover ||
      held ||
      menuHeight > 0
    ) {
      collapsed = false

      return
    }

    const timer = setTimeout(() => {
      collapsed = true
    }, HIDE_DELAY)

    return () => clearTimeout(timer)
  })

  $effect(() => {
    dockAwake.visible = !dockHidden && !pageHidden
  })

  $effect(() =>
    scheduleReminders(
      $state.snapshot(eventLive.items),
      $state.snapshot(profile),
    ),
  )
</script>

<svelte:document
  onmouseenter={() => {
    hovered = true
  }}
  onmouseleave={() => {
    hovered = false
  }}
  onvisibilitychange={() => {
    pageHidden = document.visibilityState !== "visible"
  }}
/>

<div
  class={[
    "flex h-full flex-col",
    device.dockEdge === "top" ? "justify-start" : "justify-end",
  ]}
>
  {#if collapsed || dockHidden}
    <div class="h-full w-full" aria-hidden="true"></div>
  {:else}
    <nav
      class={[
        "shrink-0 items-center gap-1 border-base-content/10",
        mac
          ? "flex justify-center rounded-[var(--shell-radius)] border px-3"
          : device.dockAlign === "start"
            ? "grid grid-cols-[auto_1fr_auto] px-2"
            : "grid grid-cols-[1fr_auto_1fr] px-2",
        !mac && (device.dockEdge === "top" ? "border-b" : "border-t"),
      ]}
      style:height="{device.dockHeight}px"
      aria-label="Dock"
    >
      <div class="flex items-center justify-self-start">
        <button
          class="btn btn-ghost btn-square btn-sm"
          title="Launcher"
          aria-label="Open launcher"
          onclick={() => native.toggleWindow("main")}
        >
          <Icon icon="lucide:sparkles" class="size-4 text-primary" />
        </button>

        {#if mac}
          <div class="mx-1.5 h-6 w-px bg-base-content/10"></div>
        {/if}
      </div>

      <div
        class={[
          "flex min-w-0 items-center gap-0.5 overflow-hidden",
          mac ? "justify-center" : "justify-self-start",
        ]}
      >
        {#each groups as group, index (group.key)}
          <DockItem
            {group}
            size={device.dockIconSize}
            edge={device.dockEdge}
            {mac}
            {foreground}
            alignEnd={index >= groups.length / 2}
            onmenu={extend}
          />
        {/each}
      </div>

      <div class="flex items-center justify-self-end">
        {#if mac}
          <div class="mx-1.5 h-6 w-px bg-base-content/10"></div>
        {/if}

        <Tray {device} {panelOpen} onclock={togglePanel} onmenu={extend} />
      </div>
    </nav>
  {/if}
</div>

<style>
  :global(.siri-aura) {
    mask-image: none;
  }

  :global(:root[data-edge="bottom"] .siri-aura) {
    top: auto;
    height: var(--dock-height);
  }

  :global(:root[data-edge="top"] .siri-aura) {
    bottom: auto;
    height: var(--dock-height);
  }

  :global(:root[data-background="solid"] .siri-shell),
  :global(:root[data-background="glass"] .siri-shell) {
    background: transparent;
    box-shadow: none;
  }

  :global(:root[data-background="solid"]) nav {
    background: var(--color-base-100);
  }
</style>
