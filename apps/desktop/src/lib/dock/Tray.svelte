<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { MenuBox } from "./layout.svelte"
  import { listen } from "@tauri-apps/api/event"
  import { exit } from "@tauri-apps/plugin-process"
  import { flip } from "svelte/animate"
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import * as native from "$lib/native"
  import {
    type DeviceSettings,
    type TraySlot,
    defaultDevice,
    updateDevice,
  } from "@eris/settings"
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
    claimFor?: (key: string) => (rect: MenuBox | null) => void
    edge?: "top" | "bottom"
    compact?: boolean
  }

  let { device, panelOpen, onclock, claimFor, edge: edgeProp, compact: compactProp }: Props = $props()

  const INFO_POLL = 5_000
  const MENU_GRACE = 600
  const SLOT_DATA = "application/x-eris-tray-slot"

  const HIDE_PATCH: Partial<Record<TraySlot, Partial<DeviceSettings>>> = {
    taskview: { showTaskView: false },
    claude: { showClaudeUsage: false },
    tray: { showTrayIcons: false },
    media: { showMedia: false },
    input: { showInputLanguage: false },
    meters: { showMeters: false, showNetwork: false },
    bluetooth: { showBluetooth: false },
    battery: { showBattery: false },
    volume: { showVolume: false },
    bell: { showNotifications: false },
    settings: { showSettingsButton: false },
    desktop: { showDesktopButton: false },
  }

  const hideItem = (id: TraySlot): MenuItem => ({
    label: $t("tray.icons.hideFromDock"),
    icon: "lucide:eye-off",
    action: () => {
      const patch = HIDE_PATCH[id]

      if (patch) {
        updateDevice(d => ({ ...d, ...patch })).catch(() => undefined)
      }
    },
  })

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
    hideItem("settings"),
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
    "separator",
    hideItem("bell"),
  ])

  let slotMenuId = $state<TraySlot | null>(null)
  let slotMenuOpen = $state(false)
  let slotMenuX = $state(0)
  let slotMenuY = $state(0)

  const openSlotMenu = (e: MouseEvent, id: TraySlot) => {
    if (e.defaultPrevented || !HIDE_PATCH[id]) {
      return
    }

    e.preventDefault()
    slotMenuId = id
    slotMenuX = e.clientX
    slotMenuY = e.clientY
    slotMenuOpen = true
  }

  const slotMenuItems = $derived.by((): MenuItem[] => {
    const id = slotMenuId

    if (!id || !HIDE_PATCH[id]) {
      return []
    }

    const items: MenuItem[] = []

    if (id === "volume" && info.volume) {
      items.push({
        label: info.volume.muted
          ? $t("tray.volume.unmute")
          : $t("tray.volume.mute"),
        icon: info.volume.muted ? "lucide:volume-2" : "lucide:volume-x",
        action: () => {
          if (info.volume) {
            info.volume = { level: info.volume.level, muted: !info.volume.muted }
          }

          native.toggleMute().catch(() => undefined)
        },
      })
    }

    if (id === "input") {
      items.push({
        label: $t("tray.input.settings"),
        icon: "lucide:settings-2",
        action: () =>
          native.openUrl("ms-settings:regionlanguage").catch(() => undefined),
      })
    }

    if (items.length > 0) {
      items.push("separator")
    }

    items.push(hideItem(id))

    return items
  })

  type Widget =
    | "claude"
    | "tray"
    | "media"
    | "input"
    | "meters"
    | "bluetooth"
    | "battery"
    | "volume"

  const compact = $derived(compactProp ?? device.dockHeight < 40)

  const edge = $derived(edgeProp ?? device.dockEdge)

  const mac = $derived(device.dockStyle === "mac")

  let menuOpen = $state(false)
  let menuRoot = $state<HTMLElement>()

  const setMenu = (next: boolean) => {
    menuOpen = next
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
      device.features.chat &&
        device.showClaudeUsage &&
        device.claudeUsageSide === "right" &&
        "claude",
      device.showTrayIcons && "tray",
      device.showMedia && device.mediaSide === "right" && "media",
      device.showInputLanguage && "input",
      (device.showMeters || device.showNetwork) && "meters",
      device.showBluetooth && "bluetooth",
      device.showBattery && info.battery !== null && "battery",
      device.showVolume && info.volume !== null && "volume",
    ].filter((w): w is Widget => typeof w === "string"),
  )

  const slots = $derived.by(() => {
    const enabled = new Set<TraySlot>(
      [
        device.showTaskView && "taskview",
        ...widgets,
        "clock",
        device.showNotifications && "bell",
        device.showSettingsButton && "settings",
        device.showDesktopButton && "desktop",
      ].filter((id): id is TraySlot => typeof id === "string"),
    )

    const seen = new Set<TraySlot>()
    const list: TraySlot[] = []

    for (const id of [...device.traySlots, ...defaultDevice.traySlots]) {
      if (enabled.has(id) && !seen.has(id)) {
        seen.add(id)
        list.push(id)
      }
    }

    return list
  })

  let blank = $state<Partial<Record<TraySlot, boolean>>>({})
  let menuClaimed = $state(false)

  const claimed = new Set<string>()

  const claim = (key: string) => (rect: MenuBox | null) => {
    if (rect) {
      claimed.add(key)
    } else {
      claimed.delete(key)
    }

    menuClaimed = claimed.size > 0
    claimFor?.(key)(rect)
  }

  let dragId = $state<TraySlot | null>(null)
  let dropId = $state<TraySlot | null>(null)
  let dropBefore = $state(true)

  const dragOver = (e: DragEvent, id: TraySlot) => {
    if (!e.dataTransfer?.types.includes(SLOT_DATA)) {
      return
    }

    e.preventDefault()

    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()

    dropId = id
    dropBefore = e.clientX < box.left + box.width / 2
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()

    const from = dragId
    const onto = dropId
    const before = dropBefore

    dragId = null
    dropId = null

    if (!from || !onto || from === onto) {
      return
    }

    updateDevice(d => {
      const ids = d.traySlots.filter(id => id !== from)
      const at = ids.indexOf(onto)

      ids.splice(at < 0 ? ids.length : before ? at : at + 1, 0, from)

      return { ...d, traySlots: ids }
    })
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

{#snippet widget(name: Widget)}
  {#if name === "claude"}
    <ClaudeUsage
      source={device.claudeUsageSource}
      compact={compact}
      stacked={device.claudeUsageStacked}
    />
  {:else if name === "tray"}
    <NotifyIcons
      compact={compact}
      onmenu={claim("icons")}
      edge={edge}
      order={device.trayOrder}
      hidden={device.trayHidden}
      onreorder={order => updateDevice(d => ({ ...d, trayOrder: order }))}
      onhide={hidden => updateDevice(d => ({ ...d, trayHidden: hidden }))}
    />
  {:else if name === "media"}
    <Media
      compact={compact}
      edge={edge}
      spectrum={device.showSpectrum}
      spectrumStyle={device.spectrumStyle}
      onmenu={claim("media")}
    />
  {:else if name === "input"}
    <InputLanguage
      compact={compact}
      onvisible={visible => (blank.input = !visible)}
    />
  {:else if name === "meters"}
    <Meters
      showMeters={device.showMeters}
      showNetwork={device.showNetwork}
      compact={compact}
      edge={edge}
      onmenu={claim("meters")}
    />
  {:else if name === "bluetooth"}
    <Bluetooth
      edge={edge}
      onmenu={claim("bluetooth")}
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
      edge={edge}
      onmenu={claim("volume")}
      onchange={next => (info.volume = next)}
    />
  {/if}
{/snippet}

{#snippet slot(id: TraySlot)}
  {#if id === "taskview"}
    <button
      class="btn btn-ghost btn-square btn-sm"
      title={$t("tray.taskView")}
      aria-label={$t("tray.taskView")}
      onclick={() => quick("taskview")}
    >
      <Icon icon="lucide:layout-grid" class="size-4 text-base-content/70" />
    </button>
  {:else if id === "clock"}
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
  {:else if id === "bell"}
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
        placement={edge === "top" ? "down" : "up"}
        align="end"
        width={208}
        label={$t("tray.notifications.title")}
        onsize={rect => claim("bell")(rect)}
        onclose={() => claim("bell")(null)}
      />
    </div>
  {:else if id === "settings"}
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
        placement={edge === "top" ? "down" : "up"}
        align="end"
        width={192}
        label={$t("tray.menu.title")}
        onsize={rect => claim("settings")(rect)}
        onclose={() => claim("settings")(null)}
      />
    </div>
  {:else if id === "desktop"}
    <button
      class={[
        "ml-1 w-1.5 shrink-0 border-l border-base-content/10 transition-colors duration-100 hover:bg-base-content/20",
        mac ? "h-6 rounded-r-full" : "h-(--dock-height)",
      ]}
      title={$t("tray.showDesktop")}
      aria-label={$t("tray.showDesktop")}
      onclick={() => quick("desktop")}
    ></button>
  {:else}
    {@render widget(id)}
  {/if}
{/snippet}

<div class="flex items-center gap-0.5" role="list">
  {#each slots as id (id)}
    <div
      animate:flip={{ duration: 120 }}
      role="listitem"
      class={[
        "relative flex items-center transition-opacity duration-100",
        dragId === id && "opacity-30",
        blank[id] && "hidden",
      ]}
      draggable={!menuClaimed}
      oncontextmenu={e => openSlotMenu(e, id)}
      ondragstart={e => {
        if (e.target !== e.currentTarget) {
          return
        }

        e.dataTransfer?.setData(SLOT_DATA, id)
        dragId = id
      }}
      ondragover={e => dragOver(e, id)}
      ondrop={drop}
      ondragend={() => {
        dragId = null
        dropId = null
      }}
    >
      {#if dropId === id && dropBefore}
        <span
          class="pointer-events-none absolute inset-y-1 -left-0.5 w-0.5 rounded-full bg-primary"
        ></span>
      {/if}

      {#if dropId === id && !dropBefore}
        <span
          class="pointer-events-none absolute inset-y-1 -right-0.5 w-0.5 rounded-full bg-primary"
        ></span>
      {/if}

      {@render slot(id)}
    </div>
  {/each}
</div>

<ContextMenu
  bind:open={slotMenuOpen}
  items={slotMenuItems}
  x={slotMenuX}
  y={slotMenuY}
  placement={edge === "top" ? "down" : "up"}
  label={$t("tray.menu.title")}
  onsize={rect => claim("slot")(rect)}
  onclose={() => claim("slot")(null)}
/>
