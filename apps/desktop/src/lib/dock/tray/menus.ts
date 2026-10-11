import { type TraySlot, updateDevice } from "@eris/settings"
import type { MenuItem } from "@eris/ui"
import { exit } from "@tauri-apps/plugin-process"
import * as native from "$lib/native"
import { hidePatch, type Translate } from "./policy"

function hideItem(id: TraySlot, t: Translate): MenuItem {
  return {
    label: t("tray.icons.hideFromDock"),
    icon: "lucide:eye-off",
    action: () => {
      const patch = hidePatch[id]
      if (patch) {
        updateDevice(d => ({ ...d, ...patch })).catch(() => undefined)
      }
    },
  }
}

export function settingsMenu(t: Translate): MenuItem[] {
  return [
    {
      label: t("common.settings"),
      icon: "lucide:settings",
      action: () => native.showWindow("settings"),
    },
    {
      label: t("tray.menu.calendar"),
      icon: "lucide:calendar",
      action: () => native.toggleWindow("panel"),
    },
    "separator",
    {
      label: t("tray.menu.lock"),
      icon: "lucide:lock",
      action: () => native.powerAction("lock"),
    },
    {
      label: t("tray.menu.sleep"),
      icon: "lucide:moon",
      action: () => native.powerAction("sleep"),
    },
    {
      label: t("tray.menu.restart"),
      icon: "lucide:rotate-ccw",
      action: () => native.powerAction("restart"),
    },
    {
      label: t("tray.menu.shutdown"),
      icon: "lucide:power",
      action: () => native.powerAction("shutdown"),
    },
    "separator",
    hideItem("settings", t),
    "separator",
    {
      label: t("tray.menu.quit"),
      icon: "lucide:circle-x",
      action: () => exit(0),
    },
  ]
}

export function notificationMenu(t: Translate): MenuItem[] {
  return [
    {
      label: t("tray.notifications.windowsCenter"),
      icon: "lucide:bell-ring",
      action: () => native.quickAction("notifications"),
    },
    {
      label: t("tray.notifications.quickSettings"),
      icon: "lucide:sliders-horizontal",
      action: () => native.quickAction("quicksettings"),
    },
    {
      label: t("tray.notifications.focusAssist"),
      icon: "lucide:moon-star",
      action: () => native.openUrl("ms-settings:quiethours"),
    },
    {
      label: t("tray.notifications.settings"),
      icon: "lucide:settings-2",
      action: () => native.openUrl("ms-settings:notifications"),
    },
    "separator",
    hideItem("bell", t),
  ]
}

export function slotMenu(
  id: TraySlot | null,
  volume: native.Volume | null,
  t: Translate,
  toggleMute: () => void,
): MenuItem[] {
  if (!id || !hidePatch[id]) {
    return []
  }
  const items: MenuItem[] = []
  if (id === "volume" && volume) {
    items.push({
      label: volume.muted ? t("tray.volume.unmute") : t("tray.volume.mute"),
      icon: volume.muted ? "lucide:volume-2" : "lucide:volume-x",
      action: toggleMute,
    })
  }
  if (id === "input") {
    items.push({
      label: t("tray.input.settings"),
      icon: "lucide:settings-2",
      action: () =>
        native.openUrl("ms-settings:regionlanguage").catch(() => undefined),
    })
  }
  if (items.length > 0) {
    items.push("separator")
  }
  items.push(hideItem(id, t))
  return items
}
