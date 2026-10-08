import { tr } from "@eris/i18n"
import type { MenuAction } from "@eris/ui"
import { SHARED } from "../locations"
import type { Explorer } from "./explorer.svelte"
import {
  prefs,
  VIEW_ICONS,
  VIEW_KEYS,
  VIEWS,
  type ViewMode,
} from "./prefs.svelte"
import { toggleTerminal } from "./terminal.svelte"

export type Command = {
  label: string
  icon: string
  keys?: string[]
  globalKeys?: string[]
  captureKeys?: string[]
  enabled?: (x: Explorer) => boolean
  run: (x: Explorer) => unknown
}

const selected = (x: Explorer) => x.selected.length > 0

const editable = (x: Explorer) => selected(x) && x.tab.kind !== "archive"

const viewCommand = (mode: ViewMode): Command => ({
  label: `explorer.views.${mode}`,
  icon: VIEW_ICONS[mode],
  globalKeys: [`Ctrl+Shift+${VIEW_KEYS[mode]}`],
  enabled: x => x.arrangeable,
  run: x => x.setView(mode),
})

const BASE = {
  refresh: {
    label: "explorer.nav.refresh",
    icon: "lucide:rotate-cw",
    globalKeys: ["F5", "Ctrl+R"],
    run: x => x.tab.refresh(),
  },
  newTab: {
    label: "explorer.tabs.new",
    icon: "lucide:plus",
    globalKeys: ["Ctrl+T"],
    run: x => x.newTab(),
  },
  closeTab: {
    label: "explorer.tabs.close",
    icon: "lucide:x",
    globalKeys: ["Ctrl+W"],
    run: x => x.close(),
  },
  nextTab: {
    label: "explorer.tabs.next",
    icon: "lucide:chevron-right",
    globalKeys: ["Ctrl+Tab"],
    run: x => x.cycleTab(1),
  },
  previousTab: {
    label: "explorer.tabs.previous",
    icon: "lucide:chevron-left",
    globalKeys: ["Ctrl+Shift+Tab"],
    run: x => x.cycleTab(-1),
  },
  newFolder: {
    label: "explorer.commands.newFolder",
    icon: "lucide:folder-plus",
    globalKeys: ["Ctrl+Shift+N"],
    enabled: x => x.filesystem,
    run: x => x.newFolder(),
  },
  newWindow: {
    label: "explorer.commands.newWindow",
    icon: "lucide:app-window",
    globalKeys: ["Ctrl+N"],
    run: x => x.openWindow(x.tab.location),
  },
  back: {
    label: "explorer.nav.back",
    icon: "lucide:arrow-left",
    globalKeys: ["Alt+ArrowLeft"],
    keys: ["Backspace"],
    enabled: x => x.tab.canBack,
    run: x => x.tab.back(),
  },
  forward: {
    label: "explorer.nav.forward",
    icon: "lucide:arrow-right",
    globalKeys: ["Alt+ArrowRight"],
    enabled: x => x.tab.canForward,
    run: x => x.tab.forward(),
  },
  up: {
    label: "explorer.nav.up",
    icon: "lucide:arrow-up",
    globalKeys: ["Alt+ArrowUp"],
    enabled: x => x.tab.canUp,
    run: x => x.tab.up(),
  },
  preview: {
    label: "explorer.commands.preview",
    icon: "lucide:panel-right",
    globalKeys: ["Alt+P"],
    run: () => {
      prefs.preview = !prefs.preview
    },
  },
  properties: {
    label: "explorer.commands.properties",
    icon: "lucide:info",
    globalKeys: ["Alt+Enter"],
    enabled: x => x.tab.kind !== "archive",
    run: x => x.properties(),
  },
  open: {
    label: "explorer.commands.open",
    icon: "lucide:square-arrow-out-up-right",
    keys: ["Enter"],
    enabled: selected,
    run: x => x.openSelected(),
  },
  rename: {
    label: "explorer.commands.rename",
    icon: "lucide:pencil",
    keys: ["F2"],
    enabled: x => x.selected.length === 1 && x.renamable(x.selected[0]),
    run: x => x.rename(),
  },
  delete: {
    label: "explorer.commands.delete",
    icon: "lucide:trash-2",
    keys: ["Delete"],
    enabled: editable,
    run: x => x.remove(false),
  },
  deletePermanently: {
    label: "explorer.commands.deletePermanently",
    icon: "lucide:trash-2",
    keys: ["Shift+Delete"],
    enabled: editable,
    run: x => x.remove(true),
  },
  cut: {
    label: "explorer.commands.cut",
    icon: "lucide:scissors",
    keys: ["Ctrl+X"],
    enabled: editable,
    run: x => x.clip(true),
  },
  copy: {
    label: "explorer.commands.copy",
    icon: "lucide:copy",
    keys: ["Ctrl+C"],
    enabled: editable,
    run: x => x.clip(false),
  },
  copyPath: {
    label: "explorer.commands.copyPath",
    icon: "lucide:link",
    keys: ["Ctrl+Shift+C"],
    enabled: selected,
    run: x => x.copyPath(),
  },
  paste: {
    label: "explorer.commands.paste",
    icon: "lucide:clipboard-paste",
    keys: ["Ctrl+V"],
    enabled: x => x.filesystem,
    run: x => x.paste(),
  },
  selectAll: {
    label: "explorer.commands.selectAll",
    icon: "lucide:check-check",
    keys: ["Ctrl+A"],
    run: x => x.selectAll(),
  },
  selectNone: {
    label: "explorer.commands.selectNone",
    icon: "lucide:square-dashed",
    run: x => x.tab.select([]),
  },
  invertSelection: {
    label: "explorer.commands.invertSelection",
    icon: "lucide:arrow-left-right",
    run: x => x.invertSelection(),
  },
  restore: {
    label: "explorer.commands.restore",
    icon: "lucide:undo-2",
    enabled: selected,
    run: x => x.restore(),
  },
  emptyBin: {
    label: "explorer.commands.emptyRecycleBin",
    icon: "lucide:trash",
    run: x => x.emptyBin(),
  },
  shared: {
    label: "explorer.places.shared",
    icon: "lucide:share-2",
    run: x => x.go(SHARED),
  },
  settings: {
    label: "explorer.commands.settings",
    icon: "lucide:settings",
    run: x => {
      x.settingsOpen = true
    },
  },
  terminal: {
    label: "terminal.title",
    icon: "lucide:square-terminal",
    captureKeys: ["Ctrl+Backquote"],
    run: () => toggleTerminal(),
  },
} satisfies Record<string, Command>

export type CommandId = keyof typeof BASE | `view.${ViewMode}`

export const COMMANDS: Record<CommandId, Command> = {
  ...BASE,
  ...(Object.fromEntries(
    VIEWS.map(mode => [`view.${mode}`, viewCommand(mode)]),
  ) as Record<`view.${ViewMode}`, Command>),
}

const keyName = (e: KeyboardEvent) => {
  if (e.code.startsWith("Key")) {
    return e.code.slice(3)
  }

  if (e.code.startsWith("Digit")) {
    return e.code.slice(5)
  }

  if (e.code === "Backquote") {
    return e.code
  }

  return e.key === " " ? "Space" : e.key
}

export const comboOf = (e: KeyboardEvent) =>
  [
    e.ctrlKey || e.metaKey ? "Ctrl" : "",
    e.shiftKey ? "Shift" : "",
    e.altKey ? "Alt" : "",
    keyName(e),
  ]
    .filter(Boolean)
    .join("+")

const bind = (field: "keys" | "globalKeys" | "captureKeys") =>
  new Map(
    (Object.entries(COMMANDS) as [CommandId, Command][]).flatMap(
      ([id, command]) => (command[field] ?? []).map(combo => [combo, id]),
    ),
  )

export const BINDINGS = {
  local: bind("keys"),
  global: bind("globalKeys"),
  capture: bind("captureKeys"),
}

export const usable = (id: CommandId, x: Explorer) =>
  COMMANDS[id].enabled?.(x) ?? true

export const runCommand = (id: CommandId, x: Explorer) => {
  if (usable(id, x)) {
    COMMANDS[id].run(x)
  }
}

const DISPLAY: Record<string, string> = {
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  ArrowDown: "Down",
  Delete: "Del",
  Backquote: "`",
}

export const hintOf = (id: CommandId) => {
  const { globalKeys = [], keys = [], captureKeys = [] } = COMMANDS[id]
  const combo = [...globalKeys, ...keys, ...captureKeys][0]

  return combo
    ?.split("+")
    .map(part => DISPLAY[part] ?? part)
    .join("+")
}

export const menuItem = (id: CommandId, x: Explorer): MenuAction => ({
  label: tr(COMMANDS[id].label),
  icon: COMMANDS[id].icon,
  hint: hintOf(id),
  disabled: !usable(id, x),
  action: () => COMMANDS[id].run(x),
})
