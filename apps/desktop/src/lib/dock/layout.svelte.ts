import {
  type DeviceSettings,
  defaultDevice,
  updateDevice,
} from "@eris/settings"
import { SvelteMap } from "svelte/reactivity"
import * as native from "$lib/native"
import { MAGNIFY_BOOST } from "./DockItem.svelte"
import { type DockGroup, dock, groupWindows, resolvePins } from "./dock.svelte"

const STRIP = 6
const CHROME = 96

export const TOPBAR_H = 34

export const FAN_STEP = 9
export const FAN_ARC = 45

export type MenuBox = {
  left: number
  top: number
  right: number
  bottom: number
}

export const fanRadiusX = (count: number) =>
  Math.min(240, Math.max(120, 90 + count * 10))

export const fanRadiusY = (height: number, icon: number) =>
  Math.max(icon + 2, height - icon * 0.55 - 2)

export const fanSpan = (count: number, icon: number) =>
  Math.ceil(
    2 * fanRadiusX(count) * Math.sin((FAN_ARC * Math.PI) / 180) + icon * 1.5,
  )

export class DockLayout {
  constructor(private surface: "taskbar" | "topbar" = "taskbar") {}

  device = $state<DeviceSettings>(defaultDevice)

  collapsed = $state(false)

  hiding = $state(false)

  dockHidden = $state(false)

  claims = new SvelteMap<string, MenuBox>()

  pointerX = $state<number | null>(null)

  navWidth = $state(0)

  leadWidth = $state(0)

  trailWidth = $state(0)

  dragPath = $state<string | null>(null)

  dropPath = $state<string | null>(null)

  dropBefore = $state(true)

  mac = $derived(this.device.dockStyle === "mac")

  uchiwa = $derived(this.device.dockStyle === "uchiwa")

  desktop = $derived(this.mac && this.device.dockDesktop)

  hidden = $derived(new Set(this.device.hiddenApps))

  spotPlacement = $derived<"up" | "down">(
    this.device.dockEdge === "top" ? "down" : "up",
  )

  slotWidth = $derived(this.device.dockIconSize + 20)

  roomForIcons = $derived(
    Math.max(0, this.navWidth - this.leadWidth - this.trailWidth - CHROME),
  )

  fits = $derived.by(() => {
    if (this.uchiwa || this.navWidth === 0) {
      return Number.POSITIVE_INFINITY
    }

    return Math.floor(this.roomForIcons / this.slotWidth)
  })

  groups = $derived(
    this.ordered(
      groupWindows(
        dock.pinned,
        resolvePins(this.device.pinnedApps, dock.apps),
        dock.windows,
      ),
    ).filter(
      g =>
        (g.pinned || this.device.showRunningApps) &&
        !(this.hidden.has(g.path) && g.windows.length === 0),
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
      ? this.leadWidth +
          this.trailWidth +
          fanSpan(this.groups.length, this.device.dockIconSize) +
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
      : this.uchiwa
        ? Math.min(this.maxDockWidth, this.naturalWidth)
        : this.device.dockWidth,
  )

  shown = $derived(
    this.groups.length <= this.fits
      ? this.groups
      : this.groups.slice(0, Math.max(1, this.fits - 1)),
  )

  spilled = $derived(this.groups.slice(this.shown.length))

  menuBox = $derived.by((): MenuBox | null => {
    let box: MenuBox | null = null

    for (const rect of this.claims.values()) {
      box = box
        ? {
            left: Math.min(box.left, rect.left),
            top: Math.min(box.top, rect.top),
            right: Math.max(box.right, rect.right),
            bottom: Math.max(box.bottom, rect.bottom),
          }
        : { ...rect }
    }

    return box
  })

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
    updateDevice(device => ({ ...device, [key]: value })).catch(() => undefined)
  }

  claimFor = (key: string) => (rect: MenuBox | null) => {
    if (rect) {
      this.claims.set(key, {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      })
      this.pointerX = null
    } else {
      this.claims.delete(key)
    }
  }

  extend = this.claimFor("shared")

  clearClaims = () => this.claims.clear()

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

    await updateDevice(device => ({ ...device, dockOrder: paths }))
  }

  applyLayout = () => {
    if (this.dockHidden) {
      return Promise.resolve(undefined)
    }

    const root = document.documentElement

    root.dataset.surface = "dock"

    if (this.surface === "topbar") {
      root.dataset.dock = "windows"
      root.dataset.edge = "top"
      root.style.setProperty("--dock-height", `${TOPBAR_H}px`)

      return native
        .applyTopbar({
          edge: "top",
          height: TOPBAR_H,
          width: 0,
          floating: false,
          autoHide: false,
          desktop: false,
          hideSystemTaskbar: this.device.hideSystemTaskbar,
          monitor: this.device.dockMonitor,
        })
        .catch(() => undefined)
    }

    root.dataset.dock = this.device.dockStyle
    root.dataset.edge = this.device.dockEdge
    root.style.setProperty("--dock-height", `${this.device.dockHeight}px`)

    return native
      .applyTaskbar({
        edge: this.device.dockEdge,
        height: this.collapsed ? STRIP : this.device.dockHeight,
        width: this.dockWidth,
        floating: this.device.dockStyle !== "windows",
        autoHide: this.device.dockAutoHide,
        desktop: this.desktop,
        hideSystemTaskbar: this.device.hideSystemTaskbar,
        monitor: this.device.dockMonitor,
      })
      .catch(() => undefined)
  }

  private seen = new Map<string, number>()

  private seq = 0

  private ordered(list: DockGroup[]) {
    const rank = new Map(
      this.device.dockOrder.map((path, index) => [path, index]),
    )
    const present = new Set<string>()

    for (const group of list) {
      present.add(group.path)

      if (!this.seen.has(group.path)) {
        this.seen.set(group.path, this.seq++)
      }
    }

    for (const path of this.seen.keys()) {
      if (!present.has(path)) {
        this.seen.delete(path)
      }
    }

    return [...list].sort(
      (a, b) =>
        (rank.get(a.path) ?? Number.MAX_SAFE_INTEGER) -
          (rank.get(b.path) ?? Number.MAX_SAFE_INTEGER) ||
        (this.seen.get(a.path) ?? 0) - (this.seen.get(b.path) ?? 0),
    )
  }
}
