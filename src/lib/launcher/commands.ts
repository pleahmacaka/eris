import { emit } from "@tauri-apps/api/event"
import { exit } from "@tauri-apps/plugin-process"
import {
  emptyRecycleBin,
  openUrl,
  type PowerAction,
  powerAction,
  runCommand,
  showWindow,
} from "../native"
import { sections } from "../settings-ui/search"
import type { Result } from "./types"

const command = (
  id: string,
  title: string,
  subtitle: string,
  icon: string,
  run: () => void | Promise<void>,
  keywords: string[] = [],
): Result => ({
  id: `command:${id}`,
  kind: "command",
  title,
  subtitle,
  icon,
  keywords,
  action: run,
  secondaryActions: [],
  score: 0,
})

const power = (
  id: PowerAction,
  title: string,
  icon: string,
  keywords: string[] = [],
) => command(id, title, "Power", icon, () => powerAction(id), keywords)

const windowsPage = (
  id: string,
  title: string,
  icon: string,
  keywords: string[] = [],
) =>
  command(
    `ms-${id}`,
    title,
    "Windows settings",
    icon,
    () => openUrl(`ms-settings:${id}`),
    [...keywords, "settings"],
  )

const windowsApp = (
  id: string,
  title: string,
  icon: string,
  exe: string,
  keywords: string[] = [],
) => command(id, title, "Windows", icon, () => runCommand(exe), keywords)

const shellFolder = (
  id: string,
  title: string,
  icon: string,
  target: string,
  keywords: string[] = [],
) =>
  command(id, title, "Folder", icon, () => runCommand(target), [
    ...keywords,
    "folder",
  ])

export const systemCommands: Result[] = [
  power("lock", "Lock", "lucide:lock", ["lock screen"]),
  power("sleep", "Sleep", "lucide:moon", ["suspend"]),
  power("hibernate", "Hibernate", "lucide:moon-star"),
  power("shutdown", "Shut down", "lucide:power", ["power off", "turn off"]),
  power("restart", "Restart", "lucide:rotate-cw", ["reboot"]),
  power("signout", "Sign out", "lucide:log-out", ["log off", "log out"]),
  command(
    "recycle",
    "Empty recycle bin",
    "System",
    "lucide:trash-2",
    emptyRecycleBin,
    ["trash"],
  ),
  command(
    "eris-settings",
    "Open Eris settings",
    "Eris",
    "lucide:settings",
    () => showWindow("settings"),
    ["preferences", "options"],
  ),
  command(
    "eris-panel",
    "Open calendar panel",
    "Eris",
    "lucide:calendar",
    () => showWindow("panel"),
    ["todo", "agenda", "events"],
  ),
  command(
    "eris-note",
    "New note",
    "Eris",
    "lucide:notebook-pen",
    async () => {
      await showWindow("panel")
      await emit("panel-new-note")
    },
    ["note", "notes", "scratch", "memo"],
  ),
  command("eris-quit", "Quit Eris", "Eris", "lucide:circle-x", () => exit(0), [
    "exit",
    "close",
  ]),
  {
    ...command(
      "eris-clipboard",
      "Clipboard history",
      "Eris",
      "lucide:clipboard",
      () => emit("launcher-query", "clip "),
      ["clip", "paste", "copy"],
    ),
    stay: true,
  },
  windowsPage("display", "Display", "lucide:monitor", ["screen", "resolution"]),
  windowsPage("bluetooth", "Bluetooth", "lucide:bluetooth", ["devices"]),
  windowsPage("network-wifi", "Wi-Fi", "lucide:wifi", ["wifi", "network"]),
  windowsPage("sound", "Sound", "lucide:volume-2", ["audio", "volume"]),
  windowsPage("notifications", "Notifications", "lucide:bell"),
  windowsPage("personalization", "Personalization", "lucide:palette", [
    "wallpaper",
    "theme",
  ]),
  windowsPage("appsfeatures", "Apps", "lucide:layout-grid", [
    "installed",
    "uninstall",
  ]),
  windowsPage("windowsupdate", "Update", "lucide:refresh-cw", [
    "windows update",
  ]),
  command(
    "taskmgr",
    "Task Manager",
    "Windows",
    "lucide:activity",
    () => runCommand("taskmgr"),
    ["processes", "performance"],
  ),
  command(
    "explorer",
    "File Explorer",
    "Windows",
    "lucide:folder",
    () => runCommand("explorer"),
    ["files", "folders"],
  ),
  command(
    "terminal",
    "Terminal",
    "Windows",
    "lucide:terminal",
    () => runCommand('wt || start "" cmd'),
    ["cmd", "console", "shell", "powershell"],
  ),
  command(
    "control",
    "Control Panel",
    "Windows",
    "lucide:sliders-horizontal",
    () => runCommand("control"),
  ),
  command(
    "screenclip",
    "Screenshot region",
    "Windows",
    "lucide:crop",
    () => openUrl("ms-screenclip:"),
    ["screenshot", "snip", "capture", "screen clip"],
  ),
  windowsApp(
    "snippingtool",
    "Snipping Tool",
    "lucide:scissors",
    "snippingtool",
    ["screenshot", "snip", "capture"],
  ),
  windowsPage("clipboard", "Clipboard", "lucide:clipboard-list", [
    "clipboard history",
    "paste",
  ]),
  windowsPage("quiethours", "Focus assist", "lucide:moon-star", [
    "do not disturb",
    "dnd",
    "quiet hours",
  ]),
  windowsPage("printers", "Printers", "lucide:printer", ["scanner", "print"]),
  windowsPage("defaultapps", "Default apps", "lucide:app-window", [
    "default browser",
    "file associations",
  ]),
  windowsPage("storagesense", "Storage", "lucide:hard-drive", [
    "disk space",
    "cleanup",
  ]),
  windowsPage("powersleep", "Power and battery", "lucide:battery-charging", [
    "battery",
    "sleep",
    "power plan",
  ]),
  windowsPage("mousetouchpad", "Mouse", "lucide:mouse", [
    "pointer",
    "cursor",
    "touchpad",
  ]),
  windowsPage("keyboard", "Keyboard", "lucide:keyboard", ["typing", "keys"]),
  windowsPage("dateandtime", "Date and time", "lucide:clock", [
    "clock",
    "timezone",
  ]),
  windowsPage("regionlanguage", "Region and language", "lucide:languages", [
    "locale",
    "keyboard layout",
  ]),
  windowsPage("startupapps", "Startup apps", "lucide:rocket", [
    "autostart",
    "boot",
    "login",
  ]),
  command(
    "windowsdefender",
    "Windows Security",
    "Windows",
    "lucide:shield-check",
    () => openUrl("windowsdefender:"),
    ["defender", "antivirus", "virus", "firewall"],
  ),
  windowsApp("devmgmt", "Device Manager", "lucide:cpu", "devmgmt.msc", [
    "drivers",
    "hardware",
  ]),
  windowsApp(
    "diskmgmt",
    "Disk Management",
    "lucide:hard-drive",
    "diskmgmt.msc",
    ["partitions", "volumes", "format"],
  ),
  windowsApp("services", "Services", "lucide:server-cog", "services.msc", [
    "daemons",
    "background",
  ]),
  windowsApp("regedit", "Registry Editor", "lucide:file-cog", "regedit", [
    "registry",
    "regedit",
  ]),
  windowsApp("eventvwr", "Event Viewer", "lucide:scroll-text", "eventvwr.msc", [
    "logs",
    "events",
  ]),
  windowsApp("msinfo32", "System information", "lucide:info", "msinfo32", [
    "specs",
    "about this pc",
    "msinfo",
  ]),
  windowsApp("charmap", "Character map", "lucide:type", "charmap", [
    "symbols",
    "unicode",
    "special characters",
  ]),
  windowsApp("calc", "Calculator", "lucide:calculator", "calc", [
    "math",
    "numbers",
  ]),
  windowsApp("notepad", "Notepad", "lucide:notebook-pen", "notepad", [
    "text editor",
    "notes",
  ]),
  windowsApp("mspaint", "Paint", "lucide:paintbrush", "mspaint", [
    "draw",
    "image editor",
  ]),
  shellFolder("downloads", "Downloads", "lucide:download", "shell:Downloads"),
  shellFolder("documents", "Documents", "lucide:file-text", "shell:Personal", [
    "my documents",
  ]),
  shellFolder("desktop", "Desktop", "lucide:layout-dashboard", "shell:Desktop"),
  shellFolder(
    "recyclebin",
    "Recycle Bin",
    "lucide:trash",
    "shell:RecycleBinFolder",
    ["trash", "bin", "deleted"],
  ),
  shellFolder(
    "thispc",
    "This PC",
    "lucide:monitor-cog",
    "shell:MyComputerFolder",
    ["my computer", "drives", "computer"],
  ),
]

export const settingsLinks: Result[] = sections.map(({ id, label, icon }) => ({
  id: `setting:${id}`,
  kind: "setting",
  title: `Eris: ${label}`,
  subtitle: "Eris settings",
  icon,
  keywords: [label],
  action: async () => {
    await showWindow("settings")
    await emit("settings-section", id)
  },
  secondaryActions: [],
  score: 0,
}))
