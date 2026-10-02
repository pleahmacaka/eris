<script lang="ts">
  import { listen } from "@tauri-apps/api/event"
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart"
  import { tick, untrack } from "svelte"
  import { getCurrentWindow, Window } from "@tauri-apps/api/window"
  import { live, scheduleReminders, events } from "$lib/data"
  import { ensureDevice } from "$lib/device"
  import { DockBar, DockLayout, dockAwake, previewHover, startDock } from "$lib/dock"
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
  import { announceUpdate } from "$lib/updates"
  import { t } from "svelte-i18n"

  const HIDE_SLIDE = 120
  const RESYNC = 50
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
  let sharing = $state(false)

  const eventLive = live(events)

  const device = $derived(layout.device)

  const gather = $derived(device.dockHideGather && profile.appearance.motion)

  const hotkey = $derived(
    `${device.launcherTrigger}|${device.launcherShortcut}`,
  )

  $effect(() => {
    const box = layout.menuBox

    native
      .extendTaskbar(
        layout.lift,
        box ? [box.left, box.top, box.right, box.bottom] : null,
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
      native.watchScreenShare(value => {
        sharing = value
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
      listen("eris-close-menus", () => {
        layout.closeLocal()
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

    if (!device.onboarded) {
      return
    }

    const wanted = device.autostart

    isEnabled()
      .then(on => (on === wanted ? undefined : wanted ? enable() : disable()))
      .catch(() => undefined)
  })

  $effect(() => {
    if (!ready || !device.onboarded) {
      return
    }

    untrack(() =>
      announceUpdate(version => ({
        title: $t("tray.update.title"),
        body: $t("tray.update.body", { values: { version } }),
      })),
    )
  })

  const stay = $derived(
    !device.dockAutoHide ||
      layout.desktop ||
      hovered ||
      edgeHover ||
      held ||
      peeking ||
      previewHover.over ||
      layout.menuBox !== null,
  )

  const root = document.documentElement

  let motionRun = 0

  const frame = () => new Promise(resolve => requestAnimationFrame(resolve))

  const gatherAnimations = () =>
    document
      .getAnimations()
      .filter(
        (a): a is CSSAnimation =>
          a instanceof CSSAnimation && a.animationName.startsWith("dock-gather"),
      )

  // updatePlaybackRate keeps compositor-run opacity in sync; assigning playbackRate shows the base style until the next commit
  const steer = async (rate: number) => {
    const list = gatherAnimations()
    const shell = list.find(a => a.animationName === "dock-gather")

    if (!shell) {
      return
    }

    const time = Number(shell.currentTime ?? 0)
    const end = Number(shell.effect?.getComputedTiming().endTime ?? 0)

    for (const a of list) {
      if (Math.abs(Number(a.currentTime ?? 0) - time) > RESYNC) {
        a.currentTime = time
      }

      a.updatePlaybackRate(rate)
    }

    if (rate > 0 ? time >= end : time <= 0) {
      return
    }

    for (const a of list) {
      a.play()
    }

    await shell.finished.catch(() => undefined)
  }

  const conceal = async () => {
    const run = ++motionRun

    layout.closeMenus()

    if (!device.dockHideAnimation) {
      layout.collapsed = true

      return
    }

    root.dataset.dockHiding = gather ? "gather" : "slide"

    if (gather) {
      await steer(1)
    } else {
      await new Promise(resolve => setTimeout(resolve, HIDE_SLIDE))
    }

    if (run === motionRun) {
      layout.collapsed = true
    }
  }

  const reveal = async () => {
    const run = ++motionRun
    const style = root.dataset.dockHiding
    const regrow = layout.collapsed

    layout.collapsed = false

    if (!style) {
      return
    }

    if (regrow) {
      await tick()
      await frame()
      await frame()
    }

    if (style === "gather" && run === motionRun) {
      await steer(-device.dockGatherHideMs / device.dockGatherShowMs)
    }

    if (run === motionRun) {
      delete root.dataset.dockHiding
    }
  }

  $effect(() => {
    if (!ready || layout.dockHidden) {
      return
    }

    if (stay) {
      untrack(reveal)

      return
    }

    const timer = setTimeout(conceal, device.dockHideDelay)

    return () => clearTimeout(timer)
  })

  $effect(() => {
    root.style.setProperty("--gather-ms", `${device.dockGatherHideMs}ms`)
    root.dataset.dockIslands = String(device.dockIslands)
  })

  $effect(() => {
    dockAwake.visible = !layout.dockHidden && !pageHidden
  })

  const watchShare = $derived(
    device.features.calendar &&
      profile.calendar.tags.some(tag => tag.hideWhileSharing),
  )

  $effect(() => {
    native.setShareWatch(watchShare).catch(() => undefined)
  })

  const calendar = $derived(JSON.stringify(profile.calendar))

  $effect(() =>
    scheduleReminders(
      device.features.calendar ? $state.snapshot(eventLive.items) : [],
      JSON.parse(calendar),
      sharing,
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
