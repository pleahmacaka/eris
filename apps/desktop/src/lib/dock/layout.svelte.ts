import { type DeviceSettings, defaultDevice, saveDevice } from "@eris/settings"
import * as native from "$lib/native"
import { MAGNIFY_BOOST } from "./DockItem.svelte"
import { type DockGroup, dock, groupWindows, resolvePins } from "./dock.svelte"

const STRIP = 6
const CHROME = 96

export class DockLayout {
  device = $state<DeviceSettings>(defaultDevice)

  collapsed = $state(false)

  dockHidden = $state(false)

  menuHeight = $state(0)

  pointerX = $state<number | null>(null)

  navWidth = $state(0)

  leadWidth = $state(0)

  trailWidth = $state(0)

  dragPath = $state<string | null>(null)

  dropPath = $state<string | null>(null)

  dropBefore = $state(true)

  mac = $derived(this.device.dockStyle === "mac")

  uchiwa = $derived(this.device.dockAlign === "uchiwa")

  desktop = $derived(this.mac && this.device.dockDesktop)

  hidden = $derived(new Set(this.device.hiddenApps))

  spotPlacement = $derived<"up" | "down">(
    this.device.dockEdge === "top" ? "down" : "up",
  )

  slotWidth = $derived(this.device.dockIconSize + 20)

  roomForIcons = $derived(
    Math.max(
      0,
      this.uchiwa
        ? (this.navWidth - CHROME) / 2 -
            Math.max(this.leadWidth, this.trailWidth)
        : this.navWidth - this.leadWidth - this.trailWidth - CHROME,
    ),
  )

  fits = $derived.by(() => {
    if (this.navWidth === 0) {
      return Number.POSITIVE_INFINITY
    }

    const slots = Math.floor(this.roomForIcons / this.slotWidth)

    return this.uchiwa ? slots * 2 : slots
  })

  groups = $derived(
    this.ordered(
      groupWindows(
        dock.pinned,
        resolvePins(this.device.pinnedApps, dock.apps),
        dock.windows,
      ).filter(
        g =>
          (g.pinned || this.device.showRunningApps) &&
          !(this.hidden.has(g.path) && g.windows.length === 0),
      ),
    ),
  )

  maxDockWidth = $derived(
    Math.max(
      360,
      (typeof window === "undefined" ? 1920 : window.screen.width) - 160,
    ),
  )

  naturalWidth = $derived(
    this.uchiwa
      ? 2 *
          (Math.max(this.leadWidth, this.trailWidth) +
            Math.ceil(this.groups.length / 2) * this.slotWidth) +
          CHROME
      : this.leadWidth +
          this.trailWidth +
          this.groups.length * this.slotWidth +
          CHROME,
  )

  dockWidth = $derived(
    this.mac
      ? Math.min(
          this.maxDockWidth,
          Math.max(this.naturalWidth, this.device.dockWidth),
        )
      : this.device.dockWidth,
  )

  shown = $derived(
    this.groups.length <= this.fits
      ? this.groups
      : this.groups.slice(0, Math.max(1, this.fits - 1)),
  )

  spilled = $derived(this.groups.slice(this.shown.length))

  half = $derived(Math.ceil(this.shown.length / 2))

  leftShown = $derived(this.uchiwa ? this.shown.slice(0, this.half) : [])

  rightShown = $derived(this.uchiwa ? this.shown.slice(this.half) : this.shown)

  lift = $derived(
    this.mac && this.pointerX !== null
      ? Math.round(this.device.dockIconSize * MAGNIFY_BOOST) + 16
      : 0,
  )

  layoutKey = $derived(
    [
      this.device.dockStyle,
      this.device.dockEdge,
      this.device.dockHeight,
      this.dockWidth,
      this.device.dockAutoHide,
      this.desktop,
      this.device.hideSystemTaskbar,
      this.device.dockMonitor,
      this.collapsed,
    ].join("|"),
  )

  preview = <K extends keyof DeviceSettings>(
    key: K,
    value: DeviceSettings[K],
  ) => {
    this.device = { ...this.device, [key]: value }
  }

  patch = <K extends keyof DeviceSettings>(
    key: K,
    value: DeviceSettings[K],
  ) => {
    this.preview(key, value)
    saveDevice($state.snapshot(this.device)).catch(() => undefined)
  }

  extend = (px: number) => {
    this.menuHeight = px
  }

  commitDrop = async () => {
    const from = this.dragPath
    const onto = this.dropPath
    const before = this.dropBefore

    this.dragPath = null
    this.dropPath = null

    if (!from || !onto || from === onto) {
      return
    }

    const paths = this.groups
      .map(group => group.path)
      .filter(path => path !== from)
    const at = paths.indexOf(onto)

    if (at < 0) {
      return
    }

    paths.splice(before ? at : at + 1, 0, from)

    await saveDevice({ ...this.device, dockOrder: paths })
  }

  applyLayout = () => {
    if (this.dockHidden) {
      return Promise.resolve(undefined)
    }

    const root = document.documentElement

    root.dataset.surface = "dock"
    root.dataset.dock = this.device.dockStyle
    root.dataset.edge = this.device.dockEdge
    root.style.setProperty("--dock-height", `${this.device.dockHeight}px`)

    return native
      .applyTaskbar({
        edge: this.device.dockEdge,
        height: this.collapsed ? STRIP : this.device.dockHeight,
        width: this.dockWidth,
        floating: this.mac,
        autoHide: this.device.dockAutoHide,
        desktop: this.desktop,
        hideSystemTaskbar: this.device.hideSystemTaskbar,
        monitor: this.device.dockMonitor,
      })
      .catch(() => undefined)
  }

  private ordered(list: DockGroup[]) {
    const rank = new Map(
      this.device.dockOrder.map((path, index) => [path, index]),
    )

    return [...list].sort(
      (a, b) =>
        (rank.get(a.path) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.path) ?? Number.MAX_SAFE_INTEGER),
    )
  }
}
