<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { MenuBox } from "./layout.svelte"
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
  import { notificationMenu, settingsMenu, slotMenu } from "./tray/menus"
  import {
    batteryIcon as iconForBattery,
    batteryTitle as titleForBattery,
    hidePatch,
    reorderSlot,
    syncTitle as titleForSync,
    syncTone as toneForSync,
    traySlots,
    type Widget,
  } from "./tray/policy"
  import { TrayStatus } from "./tray/status.svelte"
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

  const MENU_GRACE = 600
  const SLOT_DATA = "application/x-eris-tray-slot"

  const status = new TrayStatus(() => device.showNotifications && dockAwake.visible)
  const info = $derived(status.info)
  const unseen = $derived(status.unseen)
  const MENU = $derived(settingsMenu($t))
  const BELL_MENU = $derived(notificationMenu($t))

  let slotMenuId = $state<TraySlot | null>(null)
  let slotMenuOpen = $state(false)
  let slotMenuX = $state(0)
  let slotMenuY = $state(0)

  const openSlotMenu = (e: MouseEvent, id: TraySlot) => {
    if (e.defaultPrevented || !hidePatch[id]) {
      return
    }

    e.preventDefault()
    slotMenuId = id
    slotMenuX = e.clientX
    slotMenuY = e.clientY
    slotMenuOpen = true
  }

  const slotMenuItems = $derived(slotMenu(slotMenuId, info.volume, $t, status.toggleMute))

  const compact = $derived(compactProp ?? device.dockHeight < 40)

  const edge = $derived(edgeProp ?? device.dockEdge)

  const mac = $derived(device.dockStyle === "mac")

  let menuOpen = $state(false)
  let menuRoot = $state<HTMLElement>()

  const setMenu = (next: boolean) => {
    menuOpen = next
  }

  let bellMenu = $state(false)

  const openNotices = (e: MouseEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    status.openNotices(box)
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

  const slots = $derived(traySlots(device, info, defaultDevice.traySlots))

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

    updateDevice(d => ({
      ...d,
      traySlots: reorderSlot(d.traySlots, from, onto, before),
    }))
  }

  const batteryIcon = $derived(iconForBattery(info.battery))
  const batteryTitle = $derived(titleForBattery(info.battery, $t))
  const syncTone = $derived(toneForSync(syncStatus))
  const syncTitle = $derived(titleForSync(syncStatus, $t, currentLocale()))

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
      onnetworkmenu={claim("network")}
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
    {#if device.sync.enabled && device.showSyncStatus}
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
