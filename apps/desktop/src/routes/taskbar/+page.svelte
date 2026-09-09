<script lang="ts">
  import { listen } from "@tauri-apps/api/event"
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart"
  import { untrack } from "svelte"
  import { Window } from "@tauri-apps/api/window"
  import { live, scheduleReminders, events } from "$lib/data"
  import { ensureDevice } from "$lib/device"
  import { DockBar, DockLayout, dockAwake, startDock } from "$lib/dock"
  import { watchEdit } from "$lib/edit"
  import { startTimerWatch } from "$lib/launcher"
  import * as native from "$lib/native"
  import {
    defaultProfile,
    loadProfile,
    onDevice,
    onProfile,
    type Profile,
  } from "@eris/settings"
  import { startAutoSync } from "$lib/sync"

  const HIDE_DELAY = 1_200
  const VISIBILITY_POLL = 2_000
  const REOPEN_GUARD = 400

  document.documentElement.dataset.surface = "dock"

  const layout = new DockLayout()

  let profile = $state<Profile>(defaultProfile)
  let ready = $state(false)
  let hovered = $state(false)
  let edgeHover = $state(false)
  let held = $state(false)
  let panelOpen = $state(false)
  let pageHidden = $state(false)
  let hiddenAt = 0

  const eventLive = live(events)

  const device = $derived(layout.device)

  const hotkey = $derived(
    `${device.launcherTrigger}|${device.launcherShortcut}`,
  )

  $effect(() => {
    native.extendTaskbar(Math.max(layout.menuHeight, layout.lift)).catch(() => undefined)
  })

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
    const panel = await Window.getByLabel("panel")
    const visible = (await panel?.isVisible().catch(() => false)) ?? false

    await layout.applyLayout()

    if (visible) {
      panelOpen = false
      await native.hideWindow("panel")

      return
    }

    if (Date.now() - hiddenAt < REOPEN_GUARD) {
      return
    }

    panelOpen = true
    await native.showWindow("panel")
  }

  $effect(() => {
    ensureDevice().then(d => {
      layout.device = d
      ready = true
    })
    loadProfile().then(p => {
      profile = p
    })

    const stops = [
      onDevice(d => {
        layout.device = d
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
        layout.dockHidden = !e.payload.visible

        if (layout.dockHidden) {
          hovered = false
          edgeHover = false
          layout.menuHeight = 0
        } else {
          untrack(layout.applyLayout)
        }
      }),
      native.onDockFullscreen(fullscreen => {
        if (fullscreen) {
          layout.menuHeight = 0
        }
      }),
    ]
    const stopSync = startAutoSync()
    const stopDock = startDock()
    const stopTimers = startTimerWatch()
    const stopEditWatch = watchEdit()
    const poll = setInterval(refreshVisibility, VISIBILITY_POLL)

    refreshVisibility()

    return () => {
      stopSync()
      stopDock()
      stopTimers()
      stopEditWatch()
      clearInterval(poll)

      for (const stop of stops) {
        stop.then(fn => fn())
      }

      eventLive.stop()
    }
  })

  $effect(() => {
    void layout.layoutKey

    if (ready) {
      untrack(layout.applyLayout)
    }
  })

  $effect(() => {
    if (!ready) {
      return
    }

    const [trigger, shortcut] = hotkey.split("|")
    const launcher = device.features.launcher

    native
      .setLauncherShortcut(launcher && trigger !== "win" ? shortcut : null)
      .catch(() => undefined)
    native
      .setWinKeyCapture(launcher && trigger !== "shortcut")
      .catch(() => undefined)
  })

  $effect(() => {
    if (!ready) {
      return
    }

    native.setFeatures($state.snapshot(device.features)).catch(() => undefined)
  })

  $effect(() => {
    if (!ready) {
      return
    }

    native
      .setChatShortcut(device.features.chat ? device.chatShortcut : null)
      .catch(() => undefined)
  })

  $effect(() => {
    if (!ready) {
      return
    }

    const wanted = device.autostart

    isEnabled()
      .then(on => (on === wanted ? undefined : wanted ? enable() : disable()))
      .catch(() => undefined)
  })

  $effect(() => {
    if (!ready || layout.dockHidden) {
      return
    }

    if (
      !device.dockAutoHide ||
      layout.desktop ||
      hovered ||
      edgeHover ||
      held ||
      layout.menuHeight > 0
    ) {
      layout.collapsed = false

      return
    }

    const timer = setTimeout(() => {
      layout.collapsed = true
    }, HIDE_DELAY)

    return () => clearTimeout(timer)
  })

  $effect(() => {
    dockAwake.visible = !layout.dockHidden && !pageHidden
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

<DockBar {layout} {panelOpen} onclock={togglePanel} />
