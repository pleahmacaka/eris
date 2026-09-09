import type { DeviceSettings } from "@eris/settings"
import type { Translate } from "./search"

export type ShortcutItem = { keys: string[]; action: string }

export type ShortcutGroup = { title: string; items: ShortcutItem[] }

export type ShortcutDevice = Pick<
  DeviceSettings,
  "launcherTrigger" | "launcherShortcut" | "chatShortcut"
>

export const chips = (shortcut: string) =>
  shortcut.split("+").map(part => (part === "Super" ? "Win" : part))

export const shortcuts = (
  t: Translate,
  device: ShortcutDevice,
): ShortcutGroup[] => {
  const key = (name: string) => t(`settings.shortcuts.keys.${name}`)

  return [
    {
      title: t("settings.shortcuts.launcher"),
      items: [
        ...(device.launcherTrigger !== "shortcut"
          ? [{ keys: ["Win"], action: t("settings.shortcuts.openLauncher") }]
          : []),
        ...(device.launcherTrigger !== "win"
          ? [
              {
                keys: chips(device.launcherShortcut),
                action: t("settings.shortcuts.openLauncher"),
              },
            ]
          : []),
        {
          keys: [key("up"), key("down")],
          action: t("settings.shortcuts.moveSelection"),
        },
        {
          keys: [key("pageUp"), key("pageDown")],
          action: t("settings.shortcuts.movePage"),
        },
        { keys: ["Tab"], action: t("settings.shortcuts.nextGroup") },
        {
          keys: ["Shift", "Tab"],
          action: t("settings.shortcuts.previousGroup"),
        },
        { keys: ["Enter"], action: t("settings.shortcuts.openResult") },
        { keys: ["Shift", "Enter"], action: t("settings.shortcuts.openAdmin") },
        {
          keys: ["Ctrl", "Enter"],
          action: t("settings.shortcuts.openLocation"),
        },
        { keys: ["Alt", "1-9"], action: t("settings.shortcuts.openNumbered") },
        { keys: [key("menu")], action: t("settings.shortcuts.actionMenu") },
        { keys: ["Esc"], action: t("settings.shortcuts.clearThenClose") },
      ],
    },
    {
      title: t("settings.shortcuts.chat"),
      items: [
        {
          keys: chips(device.chatShortcut),
          action: t("settings.shortcuts.toggleChat"),
        },
      ],
    },
    {
      title: t("settings.shortcuts.panel"),
      items: [
        {
          keys: [key("left"), key("right")],
          action: t("settings.shortcuts.switchTabs"),
        },
        { keys: [key("arrows")], action: t("settings.shortcuts.moveDay") },
        { keys: ["Enter"], action: t("settings.shortcuts.addEvent") },
        { keys: ["F2"], action: t("settings.shortcuts.renameTodo") },
        { keys: ["Ctrl", "Enter"], action: t("settings.shortcuts.saveEvent") },
        { keys: ["Esc"], action: t("settings.shortcuts.closePanel") },
      ],
    },
    {
      title: t("settings.shortcuts.setup"),
      items: [
        { keys: ["Enter"], action: t("settings.shortcuts.nextStep") },
        { keys: ["Esc"], action: t("settings.shortcuts.closeWindow") },
      ],
    },
  ]
}
