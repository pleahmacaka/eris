import { tr } from "@eris/i18n"
import type { Result } from "@eris/launcher-core"
import { loadDevice, type TerminalApp } from "@eris/settings"
import { newWindow as newTerminalWindow } from "@eris/terminal/windows"
import { emit } from "@tauri-apps/api/event"
import { exit } from "@tauri-apps/plugin-process"
import {
  editMode,
  emptyRecycleBin,
  openErisFiles,
  openUrl,
  openWithIntent,
  type PowerAction,
  powerAction,
  runCommand,
  showWindow,
} from "../native"
import { sections } from "../settings-ui/search"
import { WINDOWS_PAGES } from "./windows-settings"

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

const TERMINAL_COMMANDS: Record<
  Exclude<TerminalApp, "auto" | "eris">,
  string
> = {
  wt: "wt",
  pwsh: "pwsh",
  powershell: "powershell",
  cmd: "cmd",
}

const openTerminal = async () => {
  const { terminal } = await loadDevice()

  if (terminal === "auto" || terminal === "eris") {
    await newTerminalWindow()

    return
  }

  await runCommand(TERMINAL_COMMANDS[terminal])
}

const power = (id: PowerAction, icon: string, keywords: string[] = []) =>
  command(
    id,
    tr(`launcher.commands.${id}`),
    tr("launcher.subtitles.power"),
    icon,
    () => powerAction(id),
    keywords,
  )

const windowsPages = () =>
  WINDOWS_PAGES.map(page =>
    command(
      `ms-${page.id}`,
      tr(`launcher.windowsSettings.${page.id}`),
      tr("launcher.subtitles.windowsSettings"),
      page.icon,
      () => openUrl(`ms-settings:${page.id}`),
      [...page.keywords, "settings"],
    ),
  )

const windowsApp = (
  id: string,
  title: string,
  icon: string,
  exe: string,
  keywords: string[] = [],
) =>
  command(
    id,
    tr(`launcher.commands.${title}`),
    tr("launcher.subtitles.windows"),
    icon,
    () => runCommand(exe),
    keywords,
  )

const shellFolder = (
  id: string,
  title: string,
  icon: string,
  target: string,
  keywords: string[] = [],
) =>
  command(
    id,
    tr(`launcher.commands.${title}`),
    tr("launcher.subtitles.folder"),
    icon,
    () => runCommand(target),
    [...keywords, "folder"],
  )

export const systemCommands = (): Result[] => [
  power("lock", "lucide:lock", ["lock screen"]),
  power("sleep", "lucide:moon", ["suspend"]),
  power("hibernate", "lucide:moon-star"),
  power("shutdown", "lucide:power", ["power off", "turn off"]),
  power("restart", "lucide:rotate-cw", ["reboot"]),
  power("signout", "lucide:log-out", ["log off", "log out"]),
  command(
    "recycle",
    tr("launcher.commands.recycle"),
    tr("launcher.subtitles.system"),
    "lucide:trash-2",
    emptyRecycleBin,
    ["trash"],
  ),
  command(
    "eris-files",
    tr("launcher.commands.erisFiles"),
    tr("launcher.subtitles.eris"),
    "lucide:folder-open",
    () => openErisFiles(),
    ["explorer", "files"],
  ),
  command(
    "eris-settings",
    tr("launcher.commands.erisSettings"),
    tr("launcher.subtitles.eris"),
    "lucide:settings",
    () => showWindow("settings"),
    ["preferences", "options"],
  ),
  command(
    "eris-panel",
    tr("launcher.commands.erisPanel"),
    tr("launcher.subtitles.eris"),
    "lucide:calendar",
    () => showWindow("panel"),
    ["calendar", "schedule", "events"],
  ),
  command(
    "eris-quit",
    tr("launcher.commands.erisQuit"),
    tr("launcher.subtitles.eris"),
    "lucide:circle-x",
    () => exit(0),
    ["exit", "close"],
  ),
  command(
    "eris-edit",
    tr("launcher.commands.erisEdit"),
    tr("launcher.subtitles.eris"),
    "lucide:pencil-ruler",
    () => editMode(true),
    ["layout", "customize", "arrange"],
  ),
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
  command(
    "taskmgr",
    tr("launcher.commands.taskmgr"),
    tr("launcher.subtitles.windows"),
    "lucide:activity",
    () => runCommand("taskmgr"),
    ["processes", "performance"],
  ),
  command(
    "explorer",
    tr("launcher.commands.explorer"),
    tr("launcher.subtitles.windows"),
    "lucide:folder",
    () => runCommand("explorer"),
    ["files", "folders"],
  ),
  command(
    "terminal",
    tr("launcher.commands.terminal"),
    tr("launcher.subtitles.windows"),
    "lucide:terminal",
    openTerminal,
    ["cmd", "console", "shell", "powershell"],
  ),
  command(
    "control",
    tr("launcher.commands.control"),
    tr("launcher.subtitles.windows"),
    "lucide:sliders-horizontal",
    () => runCommand("control"),
  ),
  command(
    "screenclip",
    tr("launcher.commands.screenclip"),
    tr("launcher.subtitles.windows"),
    "lucide:crop",
    () => openUrl("ms-screenclip:"),
    ["screenshot", "snip", "capture", "screen clip"],
  ),
  windowsApp(
    "snippingtool",
    "snippingtool",
    "lucide:scissors",
    "snippingtool",
    ["screenshot", "snip", "capture"],
  ),
  command(
    "windowsdefender",
    tr("launcher.commands.security"),
    tr("launcher.subtitles.windows"),
    "lucide:shield-check",
    () => openUrl("windowsdefender:"),
    ["defender", "antivirus", "virus", "firewall"],
  ),
  windowsApp("devmgmt", "devmgmt", "lucide:cpu", "devmgmt.msc", [
    "drivers",
    "hardware",
  ]),
  windowsApp("diskmgmt", "diskmgmt", "lucide:hard-drive", "diskmgmt.msc", [
    "partitions",
    "volumes",
    "format",
  ]),
  windowsApp("services", "services", "lucide:server-cog", "services.msc", [
    "daemons",
    "background",
  ]),
  windowsApp("regedit", "regedit", "lucide:file-cog", "regedit", [
    "registry",
    "regedit",
  ]),
  windowsApp("eventvwr", "eventvwr", "lucide:scroll-text", "eventvwr.msc", [
    "logs",
    "events",
  ]),
  windowsApp("msinfo32", "msinfo32", "lucide:info", "msinfo32", [
    "specs",
    "about this pc",
    "msinfo",
  ]),
  windowsApp("charmap", "charmap", "lucide:type", "charmap", [
    "symbols",
    "unicode",
    "special characters",
  ]),
  windowsApp("calc", "calc", "lucide:calculator", "calc", ["math", "numbers"]),
  windowsApp("notepad", "notepad", "lucide:notebook-pen", "notepad", [
    "text editor",
    "notes",
  ]),
  windowsApp("mspaint", "mspaint", "lucide:paintbrush", "mspaint", [
    "draw",
    "image editor",
  ]),
  shellFolder("downloads", "downloads", "lucide:download", "shell:Downloads"),
  shellFolder("documents", "documents", "lucide:file-text", "shell:Personal", [
    "my documents",
  ]),
  shellFolder("desktop", "desktop", "lucide:layout-dashboard", "shell:Desktop"),
  shellFolder(
    "recyclebin",
    "recyclebin",
    "lucide:trash",
    "shell:RecycleBinFolder",
    ["trash", "bin", "deleted"],
  ),
  shellFolder(
    "thispc",
    "thispc",
    "lucide:monitor-cog",
    "shell:MyComputerFolder",
    ["my computer", "drives", "computer"],
  ),
  ...windowsPages(),
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
      action: () => openWithIntent("settings", id),
      secondaryActions: [],
      score: 0,
    }
  })
