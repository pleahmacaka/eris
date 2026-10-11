import { describe, expect, test } from "bun:test"
import type { SyncStatus } from "$lib/sync"
import { defaultDevice } from "../../../../../../packages/settings/src/defaults"
import {
  batteryIcon,
  batteryTitle,
  hidePatch,
  reorderSlot,
  syncTitle,
  syncTone,
  traySlots,
} from "./policy"

const info = { battery: null, volume: null }
const slots = defaultDevice.traySlots
const status: SyncStatus = {
  state: "idle",
  peers: 1,
  lastSyncAt: null,
  lastError: null,
}
const t = (
  key: string,
  options?: { values: Record<string, string | number> },
) => (options ? `${key}:${JSON.stringify(options.values)}` : key)

describe("tray visibility and ordering", () => {
  test("clock stays visible and unavailable native widgets are omitted", () => {
    const result = traySlots(
      { ...defaultDevice, showBattery: true, showVolume: true },
      info,
      slots,
    )
    expect(result).toContain("clock")
    expect(result).not.toContain("battery")
    expect(result).not.toContain("volume")
    expect(hidePatch.clock).toBeUndefined()
    expect(hidePatch.meters).toEqual({
      showMeters: false,
      showNetwork: false,
    })
  })

  test("saved order wins, duplicates disappear and new defaults are appended", () => {
    const device = {
      ...defaultDevice,
      traySlots: ["clock", "bell", "clock"] as typeof slots,
      showNotifications: true,
      showSettingsButton: true,
      showDesktopButton: true,
    }
    const result = traySlots(device, info, slots)
    expect(result.slice(0, 2)).toEqual(["clock", "bell"])
    expect(result).toContain("settings")
    expect(result).toContain("desktop")
    expect(new Set(result).size).toBe(result.length)
    expect(device.traySlots).toEqual(["clock", "bell", "clock"])
  })

  test("side placement and native availability control widget visibility", () => {
    const device = {
      ...defaultDevice,
      showClaudeUsage: true,
      claudeUsageSide: "left" as const,
      showMedia: true,
      mediaSide: "right" as const,
      showBattery: true,
      showVolume: true,
      showMeters: false,
      showNetwork: true,
    }
    const result = traySlots(
      device,
      {
        battery: { percent: 90, charging: false },
        volume: { level: 50, muted: false },
      },
      slots,
    )
    expect(result).not.toContain("claude")
    for (const id of ["media", "battery", "volume", "meters"] as const) {
      expect(result).toContain(id)
    }
  })

  test("reordering is immutable and handles unsaved default targets", () => {
    const original = ["clock", "bell", "settings"] as typeof slots
    expect(reorderSlot(original, "clock", "settings", true)).toEqual([
      "bell",
      "clock",
      "settings",
    ])
    expect(reorderSlot(original, "clock", "settings", false)).toEqual([
      "bell",
      "settings",
      "clock",
    ])
    expect(reorderSlot(original, "clock", "desktop", true)).toEqual([
      "bell",
      "settings",
      "clock",
    ])
    expect(original).toEqual(["clock", "bell", "settings"])
  })
})

describe("tray status presentation", () => {
  test("battery boundaries and charging precedence are preserved", () => {
    expect(batteryIcon(null)).toBe("")
    for (const [percent, name] of [
      [80, "full"],
      [79, "medium"],
      [40, "medium"],
      [39, "low"],
      [15, "low"],
      [14, "warning"],
    ] as const) {
      expect(batteryIcon({ percent, charging: false })).toBe(
        `lucide:battery-${name}`,
      )
    }
    expect(batteryIcon({ percent: 1, charging: true })).toBe(
      "lucide:battery-charging",
    )
    expect(batteryTitle(null, t)).toBe("")
    expect(batteryTitle({ percent: 50, charging: true }, t)).toBe(
      'tray.battery.level:{"percent":50}, tray.battery.charging',
    )
  })

  test("sync errors and active states precede peer-count status", () => {
    expect(syncTone({ ...status, state: "error", peers: 0 })).toBe("bg-error")
    expect(syncTone({ ...status, state: "syncing", peers: 0 })).toBe(
      "bg-info animate-pulse",
    )
    expect(syncTone(status)).toBe("bg-success")
    expect(syncTone({ ...status, peers: 0 })).toBe("bg-base-content/30")
    expect(syncTitle({ ...status, state: "error", peers: 0 }, t, "en")).toBe(
      'tray.sync.failed:{"error":"tray.sync.unknownError"}',
    )
    expect(
      syncTitle({ ...status, state: "error", lastError: "offline" }, t, "en"),
    ).toBe('tray.sync.failed:{"error":"offline"}')
    expect(syncTitle({ ...status, state: "syncing", peers: 0 }, t, "en")).toBe(
      "tray.sync.syncing",
    )
    expect(syncTitle({ ...status, state: "unpaired", peers: 0 }, t, "en")).toBe(
      "tray.sync.unpaired",
    )
  })

  test("sync readiness and timestamps retain locale-specific formatting", () => {
    expect(syncTitle({ ...status, peers: 0 }, t, "en")).toBe(
      "tray.sync.waiting",
    )
    expect(syncTitle(status, t, "en")).toBe("tray.sync.ready")
    const at = new Date(2026, 1, 1, 14, 5).getTime()
    for (const locale of ["ko", "en"]) {
      const time = new Date(at).toLocaleTimeString(locale, {
        hour: "numeric",
        minute: "2-digit",
      })
      expect(syncTitle({ ...status, lastSyncAt: at }, t, locale)).toBe(
        `tray.sync.synced:${JSON.stringify({ time })}`,
      )
    }
  })
})
