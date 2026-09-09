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
import { tr } from "../i18n/locale"
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
  icon: string,
  keywords: string[] = [],
) =>
  command(id, tr(`launcher.commands.${id}`), tr("launcher.subtitles.power"), icon, () => powerAction(id), keywords)

const windowsPage = (
  id: string,
  title: string,
  icon: string,
  keywords: string[] = [],
) =>
  command(
    `ms-${id}`,
    tr(`launcher.commands.${title}`),
    tr("launcher.subtitles.windowsSettings"),
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
) =>
  command(id, tr(`launcher.commands.${title}`), tr("launcher.subtitles.windows"), icon, () => runCommand(exe), keywords)

const shellFolder = (
  id: string,
  title: string,
  icon: string,
  target: string,
  keywords: string[] = [],
) =>
  command(id, tr(`launcher.commands.${title}`), tr("launcher.subtitles.folder"), icon, () => runCommand(target), [
    ...keywords,
    "folder",
  ])

export const systemCommands = (): Result[] => [
  power("lock", "lucide:lock", ["lock screen"]),
  power("sleep", "lucide:moon", ["suspend"]),
  power("hibernate", "lucide:moon-star"),
  power("shutdown", "lucide:power", ["power off", "turn off"]),
  power("restart", "lucide:rotate-cw", ["reboot"]),
  power("signout", "lucide:log-out", ["log off", "log out"]),
  command("recycle", tr("launcher.commands.recycle"), tr("launcher.subtitles.system"), "lucide:trash-2", emptyRecycleBin, ["trash"]),
  command("eris-files", tr("launcher.commands.erisFiles"), tr("launcher.subtitles.eris"), "lucide:folder-open", () => showWindow("files"), ["explorer", "files"]),
  command("eris-settings", tr("launcher.commands.erisSettings"), tr("launcher.subtitles.eris"), "lucide:settings", () => showWindow("settings"), ["preferences", "options"]),
  command("eris-panel", tr("launcher.commands.erisPanel"), tr("launcher.subtitles.eris"), "lucide:calendar", () => showWindow("panel"), ["todo", "agenda", "events"]),
  command(
    "eris-note",
    tr("launcher.commands.erisNote"),
    tr("launcher.subtitles.eris"),
    "lucide:notebook-pen",
    async () => {
      await showWindow("panel")
      await emit("panel-new-note")
    },
    ["note", "notes", "scratch", "memo"],
  ),
  command("eris-quit", tr("launcher.commands.erisQuit"), tr("launcher.subtitles.eris"), "lucide:circle-x", () => exit(0), ["exit", "close"]),
  {
    ...command(
      "eris-clipboard",
      tr("launcher.commands.erisClipboard"),
      tr("launcher.subtitles.eris"),
      "lucide:clipboard",
      () => emit("launcher-query", "clip "),
      ["clip", "paste", "copy"],
    ),
    stay: true,
  },
  windowsPage("display", "display", "lucide:monitor", ["screen", "resolution"]),
  windowsPage("bluetooth", "bluetooth", "lucide:bluetooth", ["devices"]),
  windowsPage("network-wifi", "wifi", "lucide:wifi", ["wifi", "network"]),
  windowsPage("sound", "sound", "lucide:volume-2", ["audio", "volume"]),
  windowsPage("notifications", "notifications", "lucide:bell"),
  windowsPage("personalization", "personalization", "lucide:palette", ["wallpaper", "theme"]),
  windowsPage("appsfeatures", "apps", "lucide:layout-grid", ["installed", "uninstall"]),
  windowsPage("windowsupdate", "update", "lucide:refresh-cw", ["windows update"]),
  command("taskmgr", tr("launcher.commands.taskmgr"), tr("launcher.subtitles.windows"), "lucide:activity", () => runCommand("taskmgr"), ["processes", "performance"]),
  command("explorer", tr("launcher.commands.explorer"), tr("launcher.subtitles.windows"), "lucide:folder", () => runCommand("explorer"), ["files", "folders"]),
  command("terminal", tr("launcher.commands.terminal"), tr("launcher.subtitles.windows"), "lucide:terminal", () => runCommand('wt || start "" cmd'), ["cmd", "console", "shell", "powershell"]),
  command("control", tr("launcher.commands.control"), tr("launcher.subtitles.windows"), "lucide:sliders-horizontal", () => runCommand("control")),
  command("screenclip", tr("launcher.commands.screenclip"), tr("launcher.subtitles.windows"), "lucide:crop", () => openUrl("ms-screenclip:"), ["screenshot", "snip", "capture", "screen clip"]),
  windowsApp("snippingtool", "snippingtool", "lucide:scissors", "snippingtool", ["screenshot", "snip", "capture"]),
  windowsPage("clipboard", "clipboard", "lucide:clipboard-list", ["clipboard history", "paste"]),
  windowsPage("quiethours", "quiethours", "lucide:moon-star", ["do not disturb", "dnd", "quiet hours"]),
  windowsPage("printers", "printers", "lucide:printer", ["scanner", "print"]),
  windowsPage("defaultapps", "defaultapps", "lucide:app-window", ["default browser", "file associations"]),
  windowsPage("storagesense", "storage", "lucide:hard-drive", ["disk space", "cleanup"]),
  windowsPage("powersleep", "powersleep", "lucide:battery-charging", ["battery", "sleep", "power plan"]),
  windowsPage("mousetouchpad", "mouse", "lucide:mouse", ["pointer", "cursor", "touchpad"]),
  windowsPage("keyboard", "keyboard", "lucide:keyboard", ["typing", "keys"]),
  windowsPage("dateandtime", "dateandtime", "lucide:clock", ["clock", "timezone"]),
  windowsPage("regionlanguage", "regionlanguage", "lucide:languages", ["locale", "keyboard layout"]),
  windowsPage("startupapps", "startupapps", "lucide:rocket", ["autostart", "boot", "login"]),
  command("windowsdefender", tr("launcher.commands.security"), tr("launcher.subtitles.windows"), "lucide:shield-check", () => openUrl("windowsdefender:"), ["defender", "antivirus", "virus", "firewall"]),
  windowsApp("devmgmt", "devmgmt", "lucide:cpu", "devmgmt.msc", ["drivers", "hardware"]),
  windowsApp("diskmgmt", "diskmgmt", "lucide:hard-drive", "diskmgmt.msc", ["partitions", "volumes", "format"]),
  windowsApp("services", "services", "lucide:server-cog", "services.msc", ["daemons", "background"]),
  windowsApp("regedit", "regedit", "lucide:file-cog", "regedit", ["registry", "regedit"]),
  windowsApp("eventvwr", "eventvwr", "lucide:scroll-text", "eventvwr.msc", ["logs", "events"]),
  windowsApp("msinfo32", "msinfo32", "lucide:info", "msinfo32", ["specs", "about this pc", "msinfo"]),
  windowsApp("charmap", "charmap", "lucide:type", "charmap", ["symbols", "unicode", "special characters"]),
  windowsApp("calc", "calc", "lucide:calculator", "calc", ["math", "numbers"]),
  windowsApp("notepad", "notepad", "lucide:notebook-pen", "notepad", ["text editor", "notes"]),
  windowsApp("mspaint", "mspaint", "lucide:paintbrush", "mspaint", ["draw", "image editor"]),
  shellFolder("downloads", "downloads", "lucide:download", "shell:Downloads"),
  shellFolder("documents", "documents", "lucide:file-text", "shell:Personal", ["my documents"]),
  shellFolder("desktop", "desktop", "lucide:layout-dashboard", "shell:Desktop"),
  shellFolder("recyclebin", "recyclebin", "lucide:trash", "shell:RecycleBinFolder", ["trash", "bin", "deleted"]),
  shellFolder("thispc", "thispc", "lucide:monitor-cog", "shell:MyComputerFolder", ["my computer", "drives", "computer"]),
]

export const settingsLinks = (): Result[] =>
  sections.map(({ id, icon }) => {
    const label = tr(`settings.sections.${id}.label`)

    return {
      id: `setting:${id}`,
      kind: "setting",
      title: `Eris: ${label}`,
      subtitle: tr("launcher.subtitles.erisSettings"),
      icon,
      keywords: [label],
      action: async () => {
        await showWindow("settings")
        await emit("settings-section", id)
      },
      secondaryActions: [],
      score: 0,
    }
  })
