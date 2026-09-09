<script lang="ts">
  import Icon from "@iconify/svelte"
  import { listen } from "@tauri-apps/api/event"
  import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart"
  import { t } from "svelte-i18n"
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
  import DockItem, { MAGNIFY_BOOST } from "$lib/dock/DockItem.svelte"
  import EditSpot from "$lib/edit/EditSpot.svelte"
  import { startEdit, watchEdit } from "$lib/edit/edit.svelte"
  import Segmented from "$lib/settings-ui/Segmented.svelte"
  import ContextMenu from "$lib/ui/ContextMenu.svelte"
  import type { MenuItem } from "$lib/ui/menu"
  import ClaudeUsage from "$lib/dock/ClaudeUsage.svelte"
  import Media from "$lib/dock/Media.svelte"
  import Tray from "$lib/dock/Tray.svelte"
  import { startTimerWatch } from "$lib/launcher/timers"
  import * as native from "$lib/native"
  import {
    type ClockAlign,
    type DeviceSettings,
    type DockAlign,
    type DockSide,
    type DockStyle,
    type LauncherTrigger,
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

  document.documentElement.dataset.surface = "dock"

  type BoolKey = {
    [K in keyof DeviceSettings]: DeviceSettings[K] extends boolean ? K : never
  }[keyof DeviceSettings]

  type RangeKey = "dockIconSize" | "dockHeight" | "dockWidth"

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

  const uchiwa = $derived(device.dockAlign === "uchiwa")

  const desktop = $derived(mac && device.dockDesktop)

  const foreground = $derived(dock.windows[0]?.hwnd)

  const hotkey = $derived(
    `${device.launcherTrigger}|${device.launcherShortcut}`,
  )

  const hidden = $derived(new Set(device.hiddenApps))

  const leftWidgets = $derived(
    (device.showClaudeUsage && device.claudeUsageSide === "left") ||
      (device.showMedia && device.mediaSide === "left"),
  )

  const spotPlacement = $derived(device.dockEdge === "top" ? "down" : "up")

  const patch = <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => {
    device = { ...device, [key]: value }
    saveDevice($state.snapshot(device)).catch(() => undefined)
  }

  const styleOptions = $derived<{ value: DockStyle; label: string }[]>(
    (["windows", "mac"] as DockStyle[]).map(value => ({
      value,
      label: $t(`settings.dock.styles.${value}.label`),
    })),
  )

  const alignOptions = $derived<{ value: DockAlign; label: string }[]>(
    (["start", "center", "uchiwa"] as DockAlign[])
      .filter(value => !mac || value !== "start")
      .map(value => ({ value, label: $t(`settings.dock.${value}`) })),
  )

  const clockOptions = $derived<{ value: ClockAlign; label: string }[]>([
    { value: "start", label: $t("settings.dock.alignStart") },
    { value: "center", label: $t("settings.dock.alignCenter") },
    { value: "end", label: $t("settings.dock.alignEnd") },
  ])

  const sideOptions = $derived<{ value: DockSide; label: string }[]>([
    { value: "left", label: $t("settings.dock.left") },
    { value: "right", label: $t("settings.dock.right") },
  ])

  const triggerOptions = $derived<{ value: LauncherTrigger; label: string }[]>(
    (["win", "shortcut", "both"] as LauncherTrigger[]).map(value => ({
      value,
      label: $t(`settings.options.${value}`),
    })),
  )

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

  const CHROME = 96

  const roomForIcons = $derived(
    Math.max(
      0,
      uchiwa
        ? (navWidth - CHROME) / 2 - Math.max(leadWidth, trailWidth)
        : navWidth - leadWidth - trailWidth - CHROME,
    ),
  )

  const fits = $derived.by(() => {
    if (navWidth === 0) {
      return Number.POSITIVE_INFINITY
    }

    const slots = Math.floor(roomForIcons / slotWidth)

    return uchiwa ? slots * 2 : slots
  })

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
    uchiwa
      ? 2 * (Math.max(leadWidth, trailWidth) + Math.ceil(groups.length / 2) * slotWidth) + CHROME
      : leadWidth + trailWidth + groups.length * slotWidth + CHROME,
  )

  const dockWidth = $derived(
    mac
      ? Math.min(maxDockWidth, Math.max(naturalWidth, device.dockWidth))
      : device.dockWidth,
  )

  const shown = $derived(groups.length <= fits ? groups : groups.slice(0, Math.max(1, fits - 1)))

  const spilled = $derived(groups.slice(shown.length))

  const half = $derived(Math.ceil(shown.length / 2))

  const leftShown = $derived(uchiwa ? shown.slice(0, half) : [])

  const rightShown = $derived(uchiwa ? shown.slice(half) : shown)

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
      desktop,
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
        desktop,
        hideSystemTaskbar: device.hideSystemTaskbar,
        monitor: device.dockMonitor,
      })
      .catch(() => undefined)
  }

  let pointerX = $state<number | null>(null)

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
    ...(device.editMode
      ? ([
          {
            label: $t("dock.editLayout"),
            icon: "lucide:pencil-ruler",
            action: startEdit,
          },
          "separator",
        ] as MenuItem[])
      : []),
    {
      label: $t("dock.taskManager"),
      icon: "lucide:activity",
      action: () => native.runCommand("taskmgr"),
    },
    {
      label: device.showRunningApps ? $t("dock.hideRunning") : $t("dock.showRunning"),
      icon: device.showRunningApps ? "lucide:eye-off" : "lucide:eye",
      action: () => patch("showRunningApps", !device.showRunningApps),
    },
    {
      label: device.showSettingsButton
        ? $t("dock.hideSettingsButton")
        : $t("dock.showSettingsButton"),
      icon: "lucide:settings-2",
      action: () => patch("showSettingsButton", !device.showSettingsButton),
    },
    "separator",
    {
      label: $t("dock.settings"),
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
    if (!ready || dockHidden) {
      return
    }

    if (
      !device.dockAutoHide ||
      desktop ||
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

{#snippet toggleRow(key: BoolKey, label: string)}
  <label class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{label}</span>

    <input
      type="checkbox"
      class="toggle toggle-primary toggle-xs"
      checked={device[key]}
      onchange={e => patch(key, e.currentTarget.checked)}
    />
  </label>
{/snippet}

{#snippet rangeRow(key: RangeKey, label: string, min: number, max: number, step: number)}
  <label class="flex flex-col gap-1 py-1 text-xs">
    <span class="flex justify-between">
      <span>{label}</span>

      <span class="text-base-content/60 tabular-nums">{device[key]}</span>
    </span>

    <input
      type="range"
      class="range range-primary range-xs"
      {min}
      {max}
      {step}
      value={device[key]}
      oninput={e => (device = { ...device, [key]: Number(e.currentTarget.value) })}
      onchange={e => patch(key, Number(e.currentTarget.value))}
    />
  </label>
{/snippet}

{#snippet appsOptions()}
  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.style")}</span>

    <Segmented value={device.dockStyle} options={styleOptions} onchange={v => patch("dockStyle", v)} />
  </div>

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.alignment")}</span>

    <Segmented value={device.dockAlign} options={alignOptions} onchange={v => patch("dockAlign", v)} />
  </div>

  {@render rangeRow("dockIconSize", $t("settings.rows.iconSize"), 16, 32, 2)}
  {@render rangeRow("dockHeight", $t("settings.rows.height"), 32, 88, 2)}

  {#if mac}
    {@render rangeRow("dockWidth", $t("settings.rows.width"), 320, 1400, 20)}
    {@render toggleRow("dockDesktop", $t("settings.rows.pinDesktop"))}
  {/if}

  {@render toggleRow("showRunningApps", $t("settings.rows.showRunningApps"))}
  {@render toggleRow("dockSeparators", $t("settings.rows.dockSeparators"))}
  {@render toggleRow("dockAutoHide", $t("settings.rows.autoHide"))}
  {@render toggleRow("hideSystemTaskbar", $t("settings.rows.hideTaskbar"))}
{/snippet}

{#snippet trayOptions()}
  {@render toggleRow("clock24h", $t("settings.rows.clock24h"))}
  {@render toggleRow("showSeconds", $t("settings.rows.showSeconds"))}

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.clockAlign")}</span>

    <Segmented value={device.clockAlign} options={clockOptions} onchange={v => patch("clockAlign", v)} />
  </div>

  <div class="my-1 border-t border-base-content/10"></div>

  {@render toggleRow("showTrayIcons", $t("settings.rows.showTrayIcons"))}
  {@render toggleRow("showBattery", $t("settings.rows.showBattery"))}
  {@render toggleRow("showVolume", $t("settings.rows.showVolume"))}
  {@render toggleRow("showNetwork", $t("settings.rows.showNetwork"))}
  {@render toggleRow("showMeters", $t("settings.rows.showMeters"))}
  {@render toggleRow("showBluetooth", $t("settings.rows.showBluetooth"))}
  {@render toggleRow("showNotifications", $t("settings.rows.showNotifications"))}
  {@render toggleRow("showInputLanguage", $t("settings.rows.showInputLanguage"))}
  {@render toggleRow("showTaskView", $t("settings.rows.showTaskView"))}
  {@render toggleRow("showDesktopButton", $t("settings.rows.showDesktopButton"))}
  {@render toggleRow("showSettingsButton", $t("settings.rows.showSettingsButton"))}
{/snippet}

{#snippet widgetOptions()}
  {@render toggleRow("showClaudeUsage", $t("settings.rows.showClaudeUsage"))}
  {@render toggleRow("claudeUsageStacked", $t("settings.rows.claudeUsageStacked"))}

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.claudeUsageSide")}</span>

    <Segmented value={device.claudeUsageSide} options={sideOptions} onchange={v => patch("claudeUsageSide", v)} />
  </div>

  {@render toggleRow("showMedia", $t("settings.rows.showMedia"))}
  {@render toggleRow("showSpectrum", $t("settings.rows.showSpectrum"))}

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.mediaSide")}</span>

    <Segmented value={device.mediaSide} options={sideOptions} onchange={v => patch("mediaSide", v)} />
  </div>
{/snippet}

{#snippet launcherOptions()}
  {@render toggleRow("showLauncherButton", $t("settings.rows.showLauncherButton"))}

  <div class="flex items-center justify-between gap-3 py-1 text-xs">
    <span>{$t("settings.rows.openWith")}</span>

    <Segmented value={device.launcherTrigger} options={triggerOptions} onchange={v => patch("launcherTrigger", v)} />
  </div>
{/snippet}

{#snippet apps(list: DockGroup[], offset: number, tail: boolean)}
  <EditSpot id="apps" label={$t("edit.spots.apps")} placement={spotPlacement} onmenu={extend} options={appsOptions}>
  <div
    role="toolbar"
    tabindex="-1"
    aria-label={$t("dock.apps")}
    class="flex min-w-0 items-center gap-0.5"
    onpointermove={e => (pointerX = e.clientX)}
    onpointerleave={() => (pointerX = null)}
  >
    {#each list as group, index (group.key)}
      <div animate:flip={{ duration: 180 }} class="flex">
        <DockItem
          {group}
          size={device.dockIconSize}
          edge={device.dockEdge}
          {mac}
          {foreground}
          alignEnd={offset + index >= shown.length / 2}
          hiddenHere={hidden.has(group.path)}
          {pointerX}
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

    {#if tail && spilled.length > 0}
      <div class="relative">
        <button
          class="btn btn-ghost btn-square"
          style:--size="{device.dockIconSize + 16}px"
          title={$t("dock.more", { values: { count: spilled.length } })}
          aria-label={$t("dock.more", { values: { count: spilled.length } })}
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
          label={$t("dock.moreApps")}
          onclose={() => extend(0)}
        />
      </div>
    {/if}
  </div>
  </EditSpot>
{/snippet}

<div
  class={[
    "flex h-full select-none flex-col",
    device.dockEdge === "top" ? "justify-start" : "justify-end",
  ]}
>
  {#if collapsed || dockHidden}
    <div class="h-full w-full" aria-hidden="true"></div>
  {:else}
    <nav
      class={[
        "shrink-0 items-center gap-1 border-base-content/10",
        mac ? "rounded-[var(--shell-radius)] border px-3" : "px-2",
        !mac && (device.dockEdge === "top" ? "border-b" : "border-t"),
        uchiwa || (!mac && device.dockAlign === "center")
          ? "grid grid-cols-[1fr_auto_1fr]"
          : mac
            ? "flex justify-between"
            : "grid grid-cols-[auto_1fr_auto]",
      ]}
      style:height="{device.dockHeight}px"
      aria-label={$t("dock.dockAria")}
      bind:clientWidth={navWidth}
      oncontextmenu={openBarMenu}
    >
      <div
        class={[
          "flex items-center",
          uchiwa ? "justify-between gap-1" : "justify-self-start",
        ]}
      >
        <div class="flex items-center" bind:clientWidth={leadWidth}>
          {#if leftWidgets}
            <EditSpot id="widgets" label={$t("edit.spots.widgets")} placement={spotPlacement} align="start" onmenu={extend} options={widgetOptions}>
              {#if device.showClaudeUsage && device.claudeUsageSide === "left"}
                <ClaudeUsage
                  source={device.claudeUsageSource}
                  compact={device.dockHeight < 40}
                  stacked={device.claudeUsageStacked}
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
            </EditSpot>
          {/if}
        </div>

        {#if uchiwa}
          {@render apps(leftShown, 0, false)}
        {/if}
      </div>

      <div
        class={[
          "flex min-w-0 items-center gap-0.5",
          mac || uchiwa ? "justify-center" : "justify-self-start",
        ]}
      >
        {#if device.showLauncherButton && device.features.launcher}
          <EditSpot id="launcher" label={$t("edit.spots.launcher")} placement={spotPlacement} onmenu={extend} options={launcherOptions}>
            <button
              class="btn btn-ghost btn-square btn-sm"
              title={$t("dock.launcher")}
              aria-label={$t("dock.openLauncher")}
              onclick={() => native.toggleWindow("main")}
            >
              <Icon icon="lucide:sparkles" class="size-4 text-primary" />
            </button>
          </EditSpot>

          {#if device.dockSeparators && !uchiwa}
            <div class="mx-1.5 h-6 w-px bg-base-content/10"></div>
          {/if}
        {/if}

        {#if !uchiwa}
          {@render apps(rightShown, 0, true)}
        {/if}
      </div>

      <div
        class={[
          "flex items-center",
          uchiwa ? "justify-between gap-1" : "justify-self-end",
        ]}
      >
        {#if uchiwa}
          {@render apps(rightShown, half, true)}
        {/if}

        <div class="flex items-center" bind:clientWidth={trailWidth}>
          {#if device.dockSeparators}
            <div class="mx-1.5 h-6 w-px bg-base-content/10"></div>
          {/if}

          <EditSpot id="tray" label={$t("edit.spots.tray")} placement={spotPlacement} align="end" onmenu={extend} options={trayOptions}>
            <Tray {device} {panelOpen} onclock={togglePanel} onmenu={extend} />
          </EditSpot>
        </div>
      </div>

      <ContextMenu
        bind:open={barMenu}
        items={barMenuItems}
        x={barMenuX}
        bottom={device.dockHeight + 8}
        width={224}
        label={$t("dock.dockMenu")}
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

  nav {
    background-image: linear-gradient(
      oklch(62% calc(var(--vividness) + 0.08) var(--accent-hue) / var(--dock-tint, 0)),
      oklch(62% calc(var(--vividness) + 0.08) var(--accent-hue) / var(--dock-tint, 0))
    );
  }

  :global(:root[data-dock-border="false"]) nav {
    border-color: transparent;
  }
</style>
