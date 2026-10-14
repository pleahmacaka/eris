import { tr } from "@eris/i18n"
import type { MenuAction } from "@eris/ui"
import { COMMANDS, type CommandId, menuItem } from "./commands"
import type { Explorer } from "./explorer.svelte"

type Look = { label: string; icon: string }

const command = (id: CommandId): Look => ({
  label: COMMANDS[id].label,
  icon: COMMANDS[id].icon,
})

const LOOKS: Record<string, Look> = {
  open: command("open"),
  openInNewTab: {
    label: "explorer.commands.openInNewTab",
    icon: "lucide:panel-top",
  },
  openInNewWindow: {
    label: "explorer.commands.openInNewWindow",
    icon: "lucide:app-window",
  },
  openWith: { label: "explorer.commands.openWith", icon: "lucide:layout-grid" },
  view: { label: "explorer.commands.view", icon: "lucide:table-2" },
  refresh: command("refresh"),
  extractHere: {
    label: "explorer.bandizip.extractHere",
    icon: "lucide:package-open",
  },
  extractAuto: {
    label: "explorer.bandizip.extractAuto",
    icon: "lucide:wand-sparkles",
  },
  extractNamed: {
    label: "explorer.settings.contextMenu.items.extractNamed",
    icon: "lucide:folder-output",
  },
  compressZip: {
    label: "explorer.settings.contextMenu.items.compressZip",
    icon: "lucide:file-archive",
  },
  compress7z: {
    label: "explorer.settings.contextMenu.items.compress7z",
    icon: "lucide:file-archive",
  },
  compressEach: {
    label: "explorer.bandizip.compressEach",
    icon: "lucide:files",
  },
  cut: command("cut"),
  copy: command("copy"),
  paste: command("paste"),
  copyPath: command("copyPath"),
  share: { label: "share.action", icon: "lucide:share-2" },
  syncFolder: { label: "share.sync.menu", icon: "lucide:folder-sync" },
  rename: command("rename"),
  resetName: {
    label: "explorer.commands.resetName",
    icon: "lucide:rotate-ccw",
  },
  delete: command("delete"),
  restore: command("restore"),
  deletePermanently: command("deletePermanently"),
  newFolder: command("newFolder"),
  emptyBin: command("emptyBin"),
  pin: { label: "explorer.commands.pin", icon: "lucide:pin" },
  private: { label: "explorer.commands.markPrivate", icon: "lucide:eye-off" },
  eject: { label: "explorer.commands.eject", icon: "lucide:eject" },
  hideDevice: { label: "explorer.commands.hideDevice", icon: "lucide:eye-off" },
  hiddenDevices: {
    label: "explorer.commands.showHiddenDevices",
    icon: "lucide:eye",
  },
  disconnect: { label: "explorer.commands.disconnect", icon: "lucide:unplug" },
  mapDrive: {
    label: "explorer.commands.mapDrive",
    icon: "lucide:hard-drive-upload",
  },
  unmapDrive: { label: "explorer.commands.unmapDrive", icon: "lucide:unplug" },
  addNetworkLocation: {
    label: "explorer.commands.addNetworkLocation",
    icon: "lucide:folder-plus",
  },
  properties: command("properties"),
  moreOptions: {
    label: "explorer.commands.moreOptions",
    icon: "lucide:ellipsis",
  },
}

export const LOCKED_ITEMS = ["moreOptions"]

export const entryLabel = (id: string) => tr(LOOKS[id]?.label ?? id)

export const entryIcon = (id: string) => LOOKS[id]?.icon ?? "lucide:circle"

export const entry = (
  id: string,
  action: MenuAction["action"],
  extra: Partial<MenuAction> = {},
): MenuAction => ({
  id,
  label: entryLabel(id),
  icon: entryIcon(id),
  action,
  ...extra,
})

export const commandEntry = (id: CommandId, x: Explorer): MenuAction => ({
  ...menuItem(id, x),
  id,
})
