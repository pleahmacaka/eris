<script lang="ts">
  import Icon from "@iconify/svelte"
  import { exit } from "@tauri-apps/plugin-process"
  import * as native from "$lib/native"
  import { type DeviceSettings, saveDevice } from "$lib/settings"
  import { syncStatus } from "$lib/sync/status.svelte"
  import ContextMenu from "$lib/ui/ContextMenu.svelte"
  import type { MenuItem } from "$lib/ui/menu"
  import ClaudeUsage from "./ClaudeUsage.svelte"
  import Clock from "./Clock.svelte"
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
  const WHEEL_LOCK = 220
  const SHEET_GAP = 16

  const MENU: MenuItem[] = [
    {
      label: "Settings",
      icon: "lucide:settings",
      action: () => native.showWindow("settings"),
    },
    {
      label: "Calendar",
      icon: "lucide:calendar",
      action: () => native.toggleWindow("panel"),
    },
    "separator",
    {
      label: "Lock",
      icon: "lucide:lock",
      action: () => native.powerAction("lock"),
    },
    {
      label: "Sleep",
      icon: "lucide:moon",
      action: () => native.powerAction("sleep"),
    },
    {
      label: "Restart",
      icon: "lucide:rotate-ccw",
      action: () => native.powerAction("restart"),
    },
    {
      label: "Shut down",
      icon: "lucide:power",
      action: () => native.powerAction("shutdown"),
    },
    "separator",
    { label: "Quit Eris", icon: "lucide:circle-x", action: () => exit(0) },
  ]

  type Widget = "claude" | "tray" | "media" | "meters" | "battery" | "volume"

  const TITLES: Record<Widget, string> = {
    claude: "Claude",
    tray: "Tray",
    media: "Media",
    meters: "System",
    battery: "Battery",
    volume: "Sound",
  }

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
      (device.showMeters || device.showNetwork) && "meters",
      device.showBattery && info.battery !== null && "battery",
      device.showVolume && info.volume !== null && "volume",
    ].filter((w): w is Widget => typeof w === "string"),
  )

  let page = $state(0)

  const current = $derived(Math.min(page, Math.max(0, widgets.length - 1)))

  let wheelAt = 0

  const onwheel = (e: WheelEvent) => {
    if (e.defaultPrevented || widgets.length < 2) {
      return
    }

    const now = Date.now()

    if (now - wheelAt < WHEEL_LOCK) {
      return
    }

    wheelAt = now
    page = (current + (e.deltaY > 0 ? 1 : widgets.length - 1)) % widgets.length
  }

  let sheetOpen = $state(false)
  let sheetHeight = $state(0)

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
      return `Sync failed: ${syncStatus.lastError ?? "unknown error"}`
    }

    if (syncStatus.state === "syncing") {
      return "Syncing"
    }

    if (syncStatus.pending > 0) {
      return `Sync: ${syncStatus.pending} pending`
    }

    return syncStatus.lastSyncAt
      ? `Synced ${new Date(syncStatus.lastSyncAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
      : "Sync ready"
  })
</script>

<svelte:document onmouseleave={closeSoon} onmouseenter={cancelClose} />

<svelte:window onmousedown={onwindowdown} onkeydown={onwindowkey} />

{#snippet widget(name: Widget, nested: boolean)}
  {@const menu = nested ? extendSheet : onmenu}

  {#if name === "claude"}
    <ClaudeUsage source={device.claudeUsageSource} compact={compact && !nested} />
  {:else if name === "tray"}
    <NotifyIcons
      compact={compact && !nested}
      onmenu={menu}
      edge={device.dockEdge}
      order={device.trayOrder}
      onreorder={order => saveDevice({ ...device, trayOrder: order })}
    />
  {:else if name === "media"}
    <Media
      compact={compact && !nested}
      edge={device.dockEdge}
      spectrum={device.showSpectrum}
      spectrumStyle={device.spectrumStyle}
      onmenu={menu}
    />
  {:else if name === "meters"}
    <Meters
      showMeters={device.showMeters}
      showNetwork={device.showNetwork}
      compact={compact && !nested}
      edge={device.dockEdge}
      onmenu={menu}
    />
  {:else if name === "battery" && info.battery}
    <div
      class="flex items-center gap-1 rounded-field px-2 py-1 text-xs tabular-nums text-base-content/80"
      title={`Battery ${info.battery.percent}%${info.battery.charging ? ", charging" : ""}`}
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
  <div class={mac ? "grid" : "contents"} onwheel={mac ? onwheel : undefined}>
    {#each widgets as name, index (name)}
      {@const offset = index - current}

      <div
        class={mac
          ? [
              "col-start-1 row-start-1 flex items-center justify-center transition duration-200",
              offset === 0
                ? "opacity-100"
                : offset < 0
                  ? "-translate-y-1/2 opacity-0"
                  : "translate-y-1/2 opacity-0",
            ]
          : "contents"}
        inert={mac && offset !== 0}
        aria-hidden={mac && offset !== 0}
      >
        {@render widget(name, false)}
      </div>
    {/each}
  </div>

  {#if mac && widgets.length > 1}
    <div class="flex flex-col gap-0.5 px-0.5" aria-hidden="true">
      {#each widgets as name, index (name)}
        <span
          class={[
            "size-1 rounded-full transition-colors duration-200",
            index === current ? "bg-base-content/70" : "bg-base-content/20",
          ]}
        ></span>
      {/each}
    </div>
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
    active={panelOpen}
    onclick={onclock}
  />

  {#if device.showSettingsButton}
    <div bind:this={menuRoot} class="relative">
      <button
        class="btn btn-ghost btn-square btn-sm"
        title="Settings"
        aria-label="Open settings"
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
        label="Eris menu"
        onclose={() => onmenu?.(0)}
      />
    </div>
  {/if}

  {#if mac && widgets.length > 0}
    <div class="relative" data-widgets>
      <button
        class="btn btn-ghost btn-square btn-sm"
        title="Widgets"
        aria-label="Show widgets"
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
          aria-label="Widgets"
        >
          <ul class="divide-y divide-base-content/10">
            {#each widgets as name (name)}
              <li class="flex min-h-11 items-center justify-between gap-3 px-2 py-1">
                <span class="text-xs text-base-content/60">{TITLES[name]}</span>

                <div class="flex items-center">
                  {@render widget(name, true)}
                </div>
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}
</div>
