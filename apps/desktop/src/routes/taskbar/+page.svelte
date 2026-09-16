<script lang="ts">
  import { listen } from "@tauri-apps/api/event"
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart"
  import { untrack } from "svelte"
  import { getCurrentWindow, Window } from "@tauri-apps/api/window"
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
  const HIDE_SLIDE = 120
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
  let peeking = $state(false)
  let hiddenAt = 0

  const eventLive = live(events)

  const device = $derived(layout.device)

  const hotkey = $derived(
    `${device.launcherTrigger}|${device.launcherShortcut}`,
  )

  $effect(() => {
    const box = layout.menuBox
    const ring = layout.fanRing

    native
      .extendTaskbar(
        layout.lift,
        box ? [box.left, box.top, box.right, box.bottom] : null,
        ring,
      )
      .catch(() => undefined)
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
    if (!layout.device.features.calendar) {
      return
    }

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

        if (e.payload === "settings") {
          peeking = false
        }

        refreshVisibility()
      }),
      listen<boolean>("dock-peek", e => {
        peeking = e.payload
      }),
      listen("foreground-changed", () => {
        // the pointer still being over the dock means the user is interacting, not leaving
        if (!hovered) {
          layout.closeMenus()
        }
      }),
      listen<string>("window-shown", e => {
        if (!["taskbar", "topbar", "preview"].includes(e.payload)) {
          layout.closeMenus()
        }
      }),
      native.onDockEdge(atEdge => {
        edgeHover = atEdge
      }),
      listen<{ visible: boolean }>("dock-visible", e => {
        layout.dockHidden = !e.payload.visible

        if (layout.dockHidden) {
          hovered = false
          edgeHover = false
          layout.inside = false
          layout.closeMenus()
        } else {
          untrack(layout.applyLayout)
        }
      }),
      native.onDockFullscreen(fullscreen => {
        if (fullscreen) {
          layout.closeMenus()
        }
      }),
      getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (!focused) {
          layout.closeMenus()
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

  let applyTimer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    void layout.staticKey
    void layout.dockWidth

    if (!ready) {
      return
    }

    clearTimeout(applyTimer)

    if (layout.scrubbing) {
      return
    }

    applyTimer = setTimeout(() => untrack(layout.applyLayout), 60)

    return () => clearTimeout(applyTimer)
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
      peeking ||
      layout.menuBox !== null
    ) {
      layout.collapsed = false

      if (layout.hiding) {
        const frames = requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            layout.hiding = false
          }),
        )

        return () => cancelAnimationFrame(frames)
      }

      return
    }

    let slide: ReturnType<typeof setTimeout> | undefined
    const timer = setTimeout(() => {
      layout.closeMenus()

      if (!device.dockHideAnimation) {
        layout.collapsed = true

        return
      }

      layout.hiding = true
      slide = setTimeout(() => {
        layout.collapsed = true
      }, HIDE_SLIDE)
    }, HIDE_DELAY)

    return () => {
      clearTimeout(timer)
      clearTimeout(slide)
    }
  })

  $effect(() => {
    dockAwake.visible = !layout.dockHidden && !pageHidden
  })

  $effect(() => {
    if (layout.hiding) {
      document.documentElement.dataset.dockHiding = "true"
    } else {
      delete document.documentElement.dataset.dockHiding
    }
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
    layout.inside = true
  }}
  onmouseleave={() => {
    hovered = false
    layout.inside = false
  }}
  onvisibilitychange={() => {
    pageHidden = document.visibilityState !== "visible"
  }}
/>

<DockBar {layout} {panelOpen} onclock={togglePanel} />
