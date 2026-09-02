<script lang="ts">
  import Icon from "@iconify/svelte"
  import { exit } from "@tauri-apps/plugin-process"
  import * as native from "$lib/native"
  import type { DeviceSettings } from "$lib/settings"
  import { syncStatus } from "$lib/sync/status.svelte"
  import Clock from "./Clock.svelte"
  import Media from "./Media.svelte"
  import Meters from "./Meters.svelte"

  type Props = {
    device: DeviceSettings
    panelOpen: boolean
    onclock: () => void
    onmenu?: (height: number) => void
  }

  let { device, panelOpen, onclock, onmenu }: Props = $props()

  const INFO_POLL = 5_000
  const VOLUME_STEP = 0.05
  const MENU_HEIGHT = 284
  const MENU_GRACE = 600

  type MenuItem =
    | { label: string; icon: string; action: () => unknown }
    | "separator"

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

  const outside = (e: MouseEvent) => {
    if (menuOpen && menuRoot && !menuRoot.contains(e.target as Node)) {
      setMenu(false)
    }
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

  const run = (action: () => unknown) => {
    setMenu(false)
    Promise.resolve(action()).catch(() => undefined)
  }

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

  const volumeIcon = $derived.by(() => {
    const volume = info.volume

    if (!volume || volume.muted) {
      return "lucide:volume-x"
    }

    if (volume.level <= 0) {
      return "lucide:volume"
    }

    return volume.level < 0.5 ? "lucide:volume-1" : "lucide:volume-2"
  })

  const volumeLabel = $derived(
    !info.volume
      ? "Volume"
      : info.volume.muted
        ? "Muted"
        : `Volume ${Math.round(info.volume.level * 100)}%`,
  )

  const toggleMute = async () => {
    if (!info.volume) {
      return
    }

    info.volume.muted = !info.volume.muted
    await native.toggleMute().catch(() => undefined)
    await refresh()
  }

  const nudgeVolume = async (e: WheelEvent) => {
    if (!info.volume) {
      return
    }

    e.preventDefault()

    const direction = e.deltaY < 0 ? 1 : -1
    const level = Math.min(
      1,
      Math.max(0, info.volume.level + direction * VOLUME_STEP),
    )

    info.volume.level = Math.round(level * 100) / 100
    info.volume.muted = false
    await native.setVolume(info.volume.level).catch(() => undefined)
  }

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

<svelte:window onmousedown={outside} />

<svelte:document onmouseleave={closeSoon} onmouseenter={cancelClose} />

<div class="flex items-center gap-0.5">
  {#if device.showMedia}
    <Media {compact} />
  {/if}

  {#if device.showMeters || device.showNetwork}
    <Meters
      showMeters={device.showMeters}
      showNetwork={device.showNetwork}
      {compact}
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
    <button
      class={[
        "btn btn-ghost btn-square btn-sm",
        info.volume.muted && "text-base-content/50",
      ]}
      title={volumeLabel}
      aria-label={volumeLabel}
      onclick={toggleMute}
      onwheel={nudgeVolume}
    >
      <Icon icon={volumeIcon} class="size-4" />
    </button>
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

  <div
    bind:this={menuRoot}
    class={[
      "dropdown dropdown-end",
      device.dockEdge === "top" ? "dropdown-bottom" : "dropdown-top",
      menuOpen && "dropdown-open",
    ]}
  >
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

    {#if menuOpen}
      <ul
        class="menu dropdown-content z-10 mb-2 w-48 rounded-box border border-base-content/10 bg-base-100/90 p-1.5 shadow-lg backdrop-blur-xl"
        class:mt-2={device.dockEdge === "top"}
        role="menu"
      >
        {#each MENU as item}
          {#if item === "separator"}
            <li class="my-1 border-t border-base-content/10" role="separator"></li>
          {:else}
            <li role="none">
              <button
                role="menuitem"
                class="gap-2"
                onclick={() => run(item.action)}
              >
                <Icon icon={item.icon} class="size-4 text-base-content/60" />

                {item.label}
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    {/if}
  </div>
</div>
