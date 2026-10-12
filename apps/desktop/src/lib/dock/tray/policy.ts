import type { DeviceSettings, TraySlot } from "@eris/settings"
import type { Battery, SystemInfo } from "#lib/native/index.js"
import type { SyncStatus } from "#lib/sync/index.js"

export type Translate = (
  key: string,
  options?: { values: Record<string, string | number> },
) => string

export type Widget =
  | "claude"
  | "tray"
  | "media"
  | "input"
  | "meters"
  | "bluetooth"
  | "battery"
  | "volume"

export const hidePatch: Partial<Record<TraySlot, Partial<DeviceSettings>>> = {
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

export function traySlots(
  device: DeviceSettings,
  info: SystemInfo,
  defaults: readonly TraySlot[],
): TraySlot[] {
  const widgets = [
    device.showClaudeUsage && device.claudeUsageSide === "right" && "claude",
    device.showTrayIcons && "tray",
    device.showMedia && device.mediaSide === "right" && "media",
    device.showInputLanguage && "input",
    (device.showMeters || device.showNetwork) && "meters",
    device.showBluetooth && "bluetooth",
    device.showBattery && info.battery !== null && "battery",
    device.showVolume && info.volume !== null && "volume",
  ].filter((w): w is Widget => typeof w === "string")
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
  const slots: TraySlot[] = []
  for (const id of [...device.traySlots, ...defaults]) {
    if (enabled.has(id) && !seen.has(id)) {
      seen.add(id)
      slots.push(id)
    }
  }
  return slots
}

export function reorderSlot(
  slots: readonly TraySlot[],
  from: TraySlot,
  onto: TraySlot,
  before: boolean,
): TraySlot[] {
  const ids = slots.filter(id => id !== from)
  const at = ids.indexOf(onto)
  ids.splice(at < 0 ? ids.length : before ? at : at + 1, 0, from)
  return ids
}

export function batteryIcon(battery: Battery | null): string {
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
}

export function batteryTitle(battery: Battery | null, t: Translate): string {
  if (!battery) {
    return ""
  }
  const level = t("tray.battery.level", {
    values: { percent: battery.percent },
  })
  return battery.charging ? `${level}, ${t("tray.battery.charging")}` : level
}

export function syncTone(status: SyncStatus): string {
  return status.state === "error"
    ? "bg-error"
    : status.state === "syncing"
      ? "bg-info animate-pulse"
      : status.state === "idle" && status.peers > 0
        ? "bg-success"
        : "bg-base-content/30"
}

export function syncTitle(
  status: SyncStatus,
  t: Translate,
  locale: string,
): string {
  if (status.state === "error") {
    return t("tray.sync.failed", {
      values: { error: status.lastError ?? t("tray.sync.unknownError") },
    })
  }
  if (status.state === "syncing") {
    return t("tray.sync.syncing")
  }
  if (status.state === "unpaired") {
    return t("tray.sync.unpaired")
  }
  if (status.peers === 0) {
    return t("tray.sync.waiting")
  }
  if (!status.lastSyncAt) {
    return t("tray.sync.ready")
  }
  const at = new Date(status.lastSyncAt).toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  })
  return t("tray.sync.synced", { values: { time: at } })
}
