<script lang="ts">
  import Icon from "@iconify/svelte"
  import { listen } from "@tauri-apps/api/event"
  import { untrack } from "svelte"
  import { flip } from "svelte/animate"
  import { Window } from "@tauri-apps/api/window"
  import { live } from "$lib/data/live.svelte"
  import { scheduleReminders } from "$lib/data/reminders"
  import { events } from "$lib/data/store"
  import { ensureDevice } from "$lib/device"
  import {
    dock,
    dockAwake,
    type DockGroup,
    groupWindows,
    resolvePins,
    startDock,
  } from "$lib/dock/dock.svelte"
  import DockItem from "$lib/dock/DockItem.svelte"
  import ContextMenu from "$lib/ui/ContextMenu.svelte"
  import type { MenuItem } from "$lib/ui/menu"
  import ClaudeUsage from "$lib/dock/ClaudeUsage.svelte"
  import Media from "$lib/dock/Media.svelte"
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
    saveDevice,
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

  const hidden = $derived(new Set(device.hiddenApps))

  let dragPath = $state<string | null>(null)
  let dropPath = $state<string | null>(null)
  let dropBefore = $state(true)

  const ordered = (list: DockGroup[]) => {
    const rank = new Map(device.dockOrder.map((path, index) => [path, index]))

    return [...list].sort(
      (a, b) =>
        (rank.get(a.path) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.path) ?? Number.MAX_SAFE_INTEGER),
    )
  }

  const commitDrop = async () => {
    const from = dragPath
    const onto = dropPath
    const before = dropBefore

    dragPath = null
    dropPath = null

    if (!from || !onto || from === onto) {
      return
    }

    const paths = groups.map(group => group.path).filter(path => path !== from)
    const at = paths.indexOf(onto)

    if (at < 0) {
      return
    }

    paths.splice(before ? at : at + 1, 0, from)

    await saveDevice({ ...device, dockOrder: paths })
  }

  let navWidth = $state(0)
  let leadWidth = $state(0)
  let trailWidth = $state(0)
  let overflowOpen = $state(false)

  const slotWidth = $derived(device.dockIconSize + 20)


  const roomForIcons = $derived(
    Math.max(0, navWidth - leadWidth - trailWidth - slotWidth - 24),
  )

  const fits = $derived(
    navWidth === 0 ? Number.POSITIVE_INFINITY : Math.floor(roomForIcons / slotWidth),
  )

  const groups = $derived(
    ordered(
      groupWindows(
        dock.pinned,
        resolvePins(device.pinnedApps, dock.apps),
        dock.windows,
      ).filter(
        g =>
          (g.pinned || device.showRunningApps) &&
          !(hidden.has(g.path) && g.windows.length === 0),
      ),
    ),
  )

  const maxDockWidth = $derived(
    Math.max(360, (typeof window === "undefined" ? 1920 : window.screen.width) - 160),
  )

  const naturalWidth = $derived(
    leadWidth + trailWidth + groups.length * slotWidth + 56,
  )

  const dockWidth = $derived(
    mac
      ? Math.min(maxDockWidth, Math.max(360, naturalWidth))
      : device.dockWidth,
  )

  const shown = $derived(groups.length <= fits ? groups : groups.slice(0, Math.max(1, fits - 1)))

  const spilled = $derived(groups.slice(shown.length))

  const overflowItems = $derived.by((): MenuItem[] =>
    spilled.map(group => ({
      label: group.name,
      icon: group.windows.length > 0 ? "lucide:app-window" : "lucide:box",
      action: () =>
        group.windows[0]
          ? native.activateWindow(group.windows[0].hwnd)
          : native.launchApp(group.path),
    })),
  )

  const layoutKey = $derived(
    [
      device.dockStyle,
      device.dockEdge,
      device.dockHeight,
      dockWidth,
      device.dockAutoHide,
      device.hideSystemTaskbar,
      device.dockMonitor,
      collapsed,
    ].join("|"),
  )

  const applyLayout = () => {
    if (dockHidden) {
      return Promise.resolve(undefined)
    }

    const root = document.documentElement

    root.dataset.surface = "dock"
    root.dataset.dock = device.dockStyle
    root.dataset.edge = device.dockEdge
    root.style.setProperty("--dock-height", `${device.dockHeight}px`)

    return native
      .applyTaskbar({
        edge: device.dockEdge,
        height: collapsed ? STRIP : device.dockHeight,
        width: dockWidth,
        floating: mac,
        autoHide: device.dockAutoHide,
        hideSystemTaskbar: device.hideSystemTaskbar,
        monitor: device.dockMonitor,
      })
      .catch(() => undefined)
  }

  const MAGNIFY_BOOST = 0.55
  const MAGNIFY_SPREAD = 78

  let pointerX = $state<number | null>(null)
  let iconRow = $state<HTMLElement>()

  const lift = $derived(
    mac && pointerX !== null
      ? Math.round(device.dockIconSize * MAGNIFY_BOOST) + 16
      : 0,
  )

  const extend = (px: number) => {
    menuHeight = px
  }

  $effect(() => {
    native.extendTaskbar(Math.max(menuHeight, lift)).catch(() => undefined)
  })

  let barMenu = $state(false)
  let barMenuX = $state(0)

  const barMenuItems = $derived.by((): MenuItem[] => [
    {
      label: "Task Manager",
      icon: "lucide:activity",
      action: () => native.runCommand("taskmgr"),
    },
    {
      label: device.showRunningApps ? "Hide running apps" : "Show running apps",
      icon: device.showRunningApps ? "lucide:eye-off" : "lucide:eye",
      action: () => saveDevice({ ...device, showRunningApps: !device.showRunningApps }),
    },
    {
      label: device.showSettingsButton
        ? "Hide settings button"
        : "Show settings button",
      icon: "lucide:settings-2",
      action: () =>
        saveDevice({ ...device, showSettingsButton: !device.showSettingsButton }),
    },
    "separator",
    {
      label: "Eris 설정",
      icon: "lucide:settings",
      action: () => native.showWindow("settings"),
    },
  ])

  const openBarMenu = (e: MouseEvent) => {
    if ((e.target as Element).closest("button, [role=menu], input, a")) {
      return
    }

    e.preventDefault()
    barMenuX = e.clientX
    barMenu = true
  }

  const magnifyOf = (index: number) => {
    if (!mac || pointerX === null || !iconRow) {
      return 1
    }

    const slot = iconRow.children[index] as HTMLElement | undefined

    if (!slot) {
      return 1
    }

    const box = slot.getBoundingClientRect()
    const distance = Math.abs(box.left + box.width / 2 - pointerX)
    const falloff = Math.exp(-((distance / MAGNIFY_SPREAD) ** 2))

    return 1 + MAGNIFY_BOOST * falloff
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
    const panel = await Window.getByLabel("panel")
    const visible = (await panel?.isVisible().catch(() => false)) ?? false

    await applyLayout()

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
      bind:clientWidth={navWidth}
      oncontextmenu={openBarMenu}
    >
      <div
        class="flex items-center justify-self-start"
        bind:clientWidth={leadWidth}
      >
        {#if device.showClaudeUsage && device.claudeUsageSide === "left"}
          <ClaudeUsage
            source={device.claudeUsageSource}
            compact={device.dockHeight < 40}
          />
        {/if}

        {#if device.showMedia && device.mediaSide === "left"}
          <Media
            compact={device.dockHeight < 40}
            edge={device.dockEdge}
            spectrum={device.showSpectrum}
            spectrumStyle={device.spectrumStyle}
            onmenu={extend}
          />
        {/if}
      </div>

      <div
        class={[
          "flex min-w-0 items-center gap-0.5",
          mac ? "justify-center" : "justify-self-start",
        ]}
      >
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

        <div
          bind:this={iconRow}
          role="toolbar"
          tabindex="-1"
          aria-label="Apps"
          class="flex min-w-0 items-center gap-0.5"
          onpointermove={e => (pointerX = e.clientX)}
          onpointerleave={() => (pointerX = null)}
        >
          {#each shown as group, index (group.key)}
            <div animate:flip={{ duration: 180 }} class="flex">
              <DockItem
              {group}
              size={device.dockIconSize}
              edge={device.dockEdge}
              {mac}
              {foreground}
              alignEnd={index >= groups.length / 2}
              hiddenHere={hidden.has(group.path)}
              magnify={pointerX === null ? 1 : magnifyOf(index)}
              dragging={dragPath === group.path}
              dropBefore={dropPath === group.path && dropBefore}
              dropAfter={dropPath === group.path && !dropBefore}
              ondragstart={() => (dragPath = group.path)}
              ondragover={before => {
                dropPath = group.path
                dropBefore = before
              }}
              ondrop={commitDrop}
              ondragend={() => {
                dragPath = null
                dropPath = null
              }}
              onmenu={extend}
              />
            </div>
          {/each}

          {#if spilled.length > 0}
            <div class="relative">
              <button
                class="btn btn-ghost btn-square"
                style:--size="{device.dockIconSize + 16}px"
                title="{spilled.length} more"
                aria-label="{spilled.length} more apps"
                aria-haspopup="menu"
                aria-expanded={overflowOpen}
                onclick={() => {
                  overflowOpen = !overflowOpen
                  extend(overflowOpen ? Math.min(9, spilled.length) * 40 + 40 : 0)
                }}
              >
                <Icon icon="lucide:ellipsis" class="size-5 text-base-content/70" />
              </button>

              <ContextMenu
                bind:open={overflowOpen}
                items={overflowItems}
                placement={device.dockEdge === "top" ? "down" : "up"}
                label="More apps"
                onclose={() => extend(0)}
              />
            </div>
          {/if}
        </div>
      </div>

      <div
        class="flex items-center justify-self-end"
        bind:clientWidth={trailWidth}
      >
        {#if mac}
          <div class="mx-1.5 h-6 w-px bg-base-content/10"></div>
        {/if}

        <Tray {device} {panelOpen} onclock={togglePanel} onmenu={extend} />
      </div>

      <ContextMenu
        bind:open={barMenu}
        items={barMenuItems}
        x={barMenuX}
        bottom={device.dockHeight + 8}
        width={224}
        label="Dock menu"
        onsize={height => extend(barMenu ? height + 24 : 0)}
        onclose={() => extend(0)}
      />
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
