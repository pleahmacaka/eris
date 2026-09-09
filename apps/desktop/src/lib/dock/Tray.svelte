<script lang="ts">
  import Icon from "@iconify/svelte"
  import { listen } from "@tauri-apps/api/event"
  import { exit } from "@tauri-apps/plugin-process"
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import * as native from "$lib/native"
  import { type DeviceSettings, saveDevice } from "@eris/settings"
  import { syncStatus } from "$lib/sync"
  import { ContextMenu } from "@eris/ui"
  import type { MenuItem } from "@eris/ui"
  import Bluetooth from "./Bluetooth.svelte"
  import ClaudeUsage from "./ClaudeUsage.svelte"
  import Clock from "./Clock.svelte"
  import { dockAwake } from "./dock.svelte"
  import InputLanguage from "./InputLanguage.svelte"
  import Media from "./Media.svelte"
  import VolumeControl from "./VolumeControl.svelte"
  import Meters from "./Meters.svelte"
  import NotifyIcons from "./NotifyIcons.svelte"

  type Props = {
    device: DeviceSettings
    panelOpen: boolean
    onclock: () => void
    onmenu?: (height: number) => void
  }

  let { device, panelOpen, onclock, onmenu }: Props = $props()

  const INFO_POLL = 5_000
  const MENU_HEIGHT = 284
  const MENU_GRACE = 600
  const SHEET_GAP = 16
  const MENU_GAP = 24

  const MENU = $derived<MenuItem[]>([
    {
      label: $t("common.settings"),
      icon: "lucide:settings",
      action: () => native.showWindow("settings"),
    },
    {
      label: $t("tray.menu.calendar"),
      icon: "lucide:calendar",
      action: () => native.toggleWindow("panel"),
    },
    "separator",
    {
      label: $t("tray.menu.lock"),
      icon: "lucide:lock",
      action: () => native.powerAction("lock"),
    },
    {
      label: $t("tray.menu.sleep"),
      icon: "lucide:moon",
      action: () => native.powerAction("sleep"),
    },
    {
      label: $t("tray.menu.restart"),
      icon: "lucide:rotate-ccw",
      action: () => native.powerAction("restart"),
    },
    {
      label: $t("tray.menu.shutdown"),
      icon: "lucide:power",
      action: () => native.powerAction("shutdown"),
    },
    "separator",
    { label: $t("tray.menu.quit"), icon: "lucide:circle-x", action: () => exit(0) },
  ])

  const BELL_MENU = $derived<MenuItem[]>([
    {
      label: $t("tray.notifications.windowsCenter"),
      icon: "lucide:bell-ring",
      action: () => native.quickAction("notifications"),
    },
    {
      label: $t("tray.notifications.quickSettings"),
      icon: "lucide:sliders-horizontal",
      action: () => native.quickAction("quicksettings"),
    },
    {
      label: $t("tray.notifications.focusAssist"),
      icon: "lucide:moon-star",
      action: () => native.openUrl("ms-settings:quiethours"),
    },
    {
      label: $t("tray.notifications.settings"),
      icon: "lucide:settings-2",
      action: () => native.openUrl("ms-settings:notifications"),
    },
  ])

  type Widget =
    | "claude"
    | "tray"
    | "media"
    | "input"
    | "meters"
    | "bluetooth"
    | "battery"
    | "volume"

  const compact = $derived(device.dockHeight < 40)

  const mac = $derived(device.dockStyle === "mac")

  let menuOpen = $state(false)
  let menuRoot = $state<HTMLElement>()

  const setMenu = (next: boolean) => {
    if (menuOpen === next) {
      return
    }

    menuOpen = next
    onmenu?.(next ? MENU_HEIGHT : 0)
  }

  let bellMenu = $state(false)
  let unseen = $state(0)

  const UNSEEN_POLL = 30_000

  const refreshUnseen = async () => {
    unseen = await native.noticesUnseen().catch(() => unseen)
  }

  $effect(() => {
    if (!device.showNotifications || !dockAwake.visible) {
      return
    }

    refreshUnseen()

    const timer = setInterval(refreshUnseen, UNSEEN_POLL)
    const stop = listen("notices-changed", refreshUnseen)

    return () => {
      clearInterval(timer)
      stop.then(off => off()).catch(() => undefined)
    }
  })

  const openNotices = () => {
    unseen = 0
    native.noticesOpenPanel().catch(() => undefined)
  }

  let leaveTimer: ReturnType<typeof setTimeout> | undefined

  const cancelClose = () => {
    clearTimeout(leaveTimer)
  }

  const closeSoon = () => {
    if (!menuOpen) {
      return
    }

    cancelClose()
    leaveTimer = setTimeout(() => setMenu(false), MENU_GRACE)
  }

  $effect(() => cancelClose)

  let info = $state<native.SystemInfo>({ battery: null, volume: null })

  const refresh = async () => {
    info = await native.systemInfo().catch(() => info)
  }

  $effect(() => {
    refresh()

    const timer = setInterval(refresh, INFO_POLL)

    return () => clearInterval(timer)
  })

  const widgets = $derived(
    [
      device.showClaudeUsage && device.claudeUsageSide === "right" && "claude",
      device.showTrayIcons && "tray",
      device.showMedia && device.mediaSide === "right" && "media",
      device.showInputLanguage && "input",
      (device.showMeters || device.showNetwork) && "meters",
      device.showBluetooth && "bluetooth",
      device.showBattery && info.battery !== null && "battery",
      device.showVolume && info.volume !== null && "volume",
    ].filter((w): w is Widget => typeof w === "string"),
  )

  let sheetOpen = $state(false)
  let sheetHeight = $state(0)
  let blank = $state<Partial<Record<Widget, boolean>>>({})

  const extendSheet = (inner = 0) => {
    if (sheetOpen) {
      onmenu?.(sheetHeight + SHEET_GAP + inner)
    }
  }

  const setSheet = (next: boolean) => {
    if (sheetOpen === next) {
      return
    }

    sheetOpen = next

    if (!next) {
      onmenu?.(0)
    }
  }

  $effect(() => {
    if (sheetOpen && sheetHeight > 0) {
      extendSheet()
    }
  })

  const chevron = $derived(
    (device.dockEdge === "bottom") !== sheetOpen
      ? "lucide:chevron-up"
      : "lucide:chevron-down",
  )

  const onwindowdown = (e: MouseEvent) => {
    if (sheetOpen && !(e.target as Element).closest("[data-widgets]")) {
      setSheet(false)
    }
  }

  const onwindowkey = (e: KeyboardEvent) => {
    if (sheetOpen && e.key === "Escape") {
      setSheet(false)
    }
  }

  const batteryIcon = $derived.by(() => {
    const battery = info.battery

    if (!battery) {
      return ""
    }

    if (battery.charging) {
      return "lucide:battery-charging"
    }

    if (battery.percent >= 80) {
      return "lucide:battery-full"
    }

    if (battery.percent >= 40) {
      return "lucide:battery-medium"
    }

    if (battery.percent >= 15) {
      return "lucide:battery-low"
    }

    return "lucide:battery-warning"
  })

  const batteryTitle = $derived.by(() => {
    const battery = info.battery

    if (!battery) {
      return ""
    }

    const level = $t("tray.battery.level", { values: { percent: battery.percent } })

    return battery.charging ? `${level}, ${$t("tray.battery.charging")}` : level
  })

  const syncTone = $derived(
    syncStatus.state === "error"
      ? "bg-error"
      : syncStatus.state === "syncing"
        ? "bg-info animate-pulse"
        : syncStatus.state === "idle"
          ? "bg-success"
          : "bg-base-content/30",
  )

  const syncTitle = $derived.by(() => {
    if (syncStatus.state === "error") {
      return $t("tray.sync.failed", {
        values: { error: syncStatus.lastError ?? $t("tray.sync.unknownError") },
      })
    }

    if (syncStatus.state === "syncing") {
      return $t("tray.sync.syncing")
    }

    if (syncStatus.pending > 0) {
      return $t("tray.sync.pending", { values: { count: syncStatus.pending } })
    }

    if (!syncStatus.lastSyncAt) {
      return $t("tray.sync.ready")
    }

    const at = new Date(syncStatus.lastSyncAt).toLocaleTimeString(currentLocale(), {
      hour: "numeric",
      minute: "2-digit",
    })

    return $t("tray.sync.synced", { values: { time: at } })
  })

  const quick = (action: native.QuickAction) => {
    native.quickAction(action).catch(() => undefined)
  }
</script>

<svelte:document onmouseleave={closeSoon} onmouseenter={cancelClose} />

<svelte:window onmousedown={onwindowdown} onkeydown={onwindowkey} />

{#snippet widget(name: Widget, nested: boolean)}
  {@const menu = nested ? extendSheet : onmenu}

  {#if name === "claude"}
    <ClaudeUsage
      source={device.claudeUsageSource}
      compact={compact && !nested}
      stacked={device.claudeUsageStacked}
    />
  {:else if name === "tray"}
    <NotifyIcons
      compact={compact && !nested}
      flat={nested}
      onmenu={menu}
      edge={device.dockEdge}
      order={device.trayOrder}
      hidden={device.trayHidden}
      onreorder={order => saveDevice({ ...device, trayOrder: order })}
      onhide={hidden => saveDevice({ ...device, trayHidden: hidden })}
    />
  {:else if name === "media"}
    <Media
      compact={compact && !nested}
      edge={device.dockEdge}
      spectrum={device.showSpectrum}
      spectrumStyle={device.spectrumStyle}
      onmenu={menu}
    />
  {:else if name === "input"}
    <InputLanguage
      compact={compact && !nested}
      onvisible={visible => (blank.input = !visible)}
    />
  {:else if name === "meters"}
    <Meters
      showMeters={device.showMeters}
      showNetwork={device.showNetwork}
      compact={compact && !nested}
      edge={device.dockEdge}
      onmenu={menu}
    />
  {:else if name === "bluetooth"}
    <Bluetooth
      edge={device.dockEdge}
      onmenu={menu}
      onvisible={visible => (blank.bluetooth = !visible)}
    />
  {:else if name === "battery" && info.battery}
    <div
      class="flex items-center gap-1 rounded-field px-2 py-1 text-xs tabular-nums text-base-content/80"
      title={batteryTitle}
    >
      <Icon icon={batteryIcon} class="size-4" />

      <span>{info.battery.percent}%</span>
    </div>
  {:else if name === "volume" && info.volume}
    <VolumeControl
      volume={info.volume}
      edge={device.dockEdge}
      onmenu={menu}
      onchange={next => (info.volume = next)}
    />
  {/if}
{/snippet}

<div class="flex items-center gap-0.5">
  {#if device.showTaskView}
    <button
      class="btn btn-ghost btn-square btn-sm"
      title={$t("tray.taskView")}
      aria-label={$t("tray.taskView")}
      onclick={() => quick("taskview")}
    >
      <Icon icon="lucide:layout-grid" class="size-4 text-base-content/70" />
    </button>
  {/if}

  {#if !mac}
    {#each widgets as name (name)}
      {@render widget(name, false)}
    {/each}
  {/if}

  {#if device.sync.enabled}
    <span
      class={["mx-1 inline-block size-1.5 rounded-full", syncTone]}
      title={syncTitle}
      aria-label={syncTitle}
      role="status"
    ></span>
  {/if}

  <Clock
    clock24h={device.clock24h}
    showSeconds={device.showSeconds}
    align={device.clockAlign}
    active={panelOpen}
    onclick={onclock}
  />

  {#if device.showNotifications}
    <div class="relative">
      <button
        class="btn btn-ghost btn-square btn-sm"
        title={$t("tray.notifications.title")}
        aria-label={$t("tray.notifications.open")}
        aria-haspopup="menu"
        aria-expanded={bellMenu}
        onclick={openNotices}
        oncontextmenu={e => {
          e.preventDefault()
          bellMenu = true
        }}
      >
        <Icon icon={unseen > 0 ? "lucide:bell-dot" : "lucide:bell"} class="size-4 text-base-content/70" />

        {#if unseen > 0}
          <span
            class="badge badge-primary badge-xs absolute -top-1 -right-1 px-1 tabular-nums"
            aria-label={$t("tray.notifications.unseen", { values: { count: unseen } })}
          >
            {Math.min(unseen, 99)}
          </span>
        {/if}
      </button>

      <ContextMenu
        bind:open={bellMenu}
        items={BELL_MENU}
        placement={device.dockEdge === "top" ? "down" : "up"}
        align="end"
        width={208}
        label={$t("tray.notifications.title")}
        onsize={height => onmenu?.(height + MENU_GAP)}
        onclose={() => onmenu?.(0)}
      />
    </div>
  {/if}

  {#if device.showSettingsButton}
    <div bind:this={menuRoot} class="relative">
      <button
        class="btn btn-ghost btn-square btn-sm"
        title={$t("common.settings")}
        aria-label={$t("tray.openSettings")}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onclick={() => native.showWindow("settings")}
        oncontextmenu={e => {
          e.preventDefault()
          setMenu(true)
        }}
      >
        <Icon icon="lucide:settings" class="size-4 text-base-content/70" />
      </button>

      <ContextMenu
        bind:open={menuOpen}
        items={MENU}
        placement={device.dockEdge === "top" ? "down" : "up"}
        align="end"
        width={192}
        label={$t("tray.menu.title")}
        onclose={() => onmenu?.(0)}
      />
    </div>
  {/if}

  {#if mac && widgets.length > 0}
    <div class="relative" data-widgets>
      <button
        class="btn btn-ghost btn-square btn-sm"
        title={$t("tray.widgets.title")}
        aria-label={$t("tray.widgets.open")}
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        onclick={() => setSheet(!sheetOpen)}
      >
        <Icon icon={chevron} class="size-4 text-base-content/70" />
      </button>

      {#if sheetOpen}
        <div
          bind:offsetHeight={sheetHeight}
          class={[
            "absolute right-0 z-50 w-80 rounded-box border border-base-content/10 bg-base-100/90 p-2 shadow-xl backdrop-blur-xl",
            device.dockEdge === "top" ? "top-full mt-2" : "bottom-full mb-2",
          ]}
          role="dialog"
          aria-label={$t("tray.widgets.title")}
        >
          <ul class="divide-y divide-base-content/10">
            {#each widgets as name (name)}
              <li
                class={[
                  "flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 py-1",
                  blank[name] && "hidden",
                ]}
              >
                <span class="text-xs text-base-content/60">{$t(`tray.widgets.${name}`)}</span>

                <div class="flex min-w-0 flex-wrap items-center justify-end">
                  {@render widget(name, true)}
                </div>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}

  {#if device.showDesktopButton}
    <button
      class={[
        "ml-1 w-1.5 shrink-0 border-l border-base-content/10 transition-colors duration-150 hover:bg-base-content/20",
        mac ? "h-6 rounded-r-full" : "h-(--dock-height)",
      ]}
      title={$t("tray.showDesktop")}
      aria-label={$t("tray.showDesktop")}
      onclick={() => quick("desktop")}
    ></button>
  {/if}
</div>
