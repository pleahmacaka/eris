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

  const compact = $derived(device.dockHeight < 40)

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

<div class="flex items-center gap-0.5">
  {#if device.showClaudeUsage && device.claudeUsageSide === "right"}
    <ClaudeUsage source={device.claudeUsageSource} {compact} />
  {/if}

  {#if device.showTrayIcons}
    <NotifyIcons
      {compact}
      order={device.trayOrder}
      onreorder={order => saveDevice({ ...device, trayOrder: order })}
    />
  {/if}

  {#if device.showMedia && device.mediaSide === "right"}
    <Media
      {compact}
      edge={device.dockEdge}
      spectrum={device.showSpectrum}
      spectrumStyle={device.spectrumStyle}
      {onmenu}
    />
  {/if}

  {#if device.showMeters || device.showNetwork}
    <Meters
      showMeters={device.showMeters}
      showNetwork={device.showNetwork}
      {compact}
      edge={device.dockEdge}
      {onmenu}
    />
  {/if}

  {#if device.showBattery && info.battery}
    <div
      class="flex items-center gap-1 rounded-field px-2 py-1 text-xs tabular-nums text-base-content/80"
      title={`Battery ${info.battery.percent}%${info.battery.charging ? ", charging" : ""}`}
    >
      <Icon icon={batteryIcon} class="size-4" />

      <span>{info.battery.percent}%</span>
    </div>
  {/if}

  {#if device.showVolume && info.volume}
    <VolumeControl
      volume={info.volume}
      edge={device.dockEdge}
      {onmenu}
      onchange={next => (info.volume = next)}
    />
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
</div>
