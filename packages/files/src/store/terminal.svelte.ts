import { DEFAULT_FONT, loadShells, openTab, session } from "@eris/terminal"
import { packageManagers } from "../native"
import { persisted } from "./persisted.svelte"

export type TerminalPosition = "bottom" | "side"

export type TerminalPrefs = {
  position: TerminalPosition
  shell: string | null
  fontFamily: string
  height: number
  width: number
  packageManager: string | null
}

export const terminalPrefs = persisted<TerminalPrefs>("eris-files.terminal", {
  position: "bottom",
  shell: null,
  fontFamily: DEFAULT_FONT,
  height: 16,
  width: 30,
  packageManager: null,
})

export const terminal = $state({
  open: false,
  position: null as TerminalPosition | null,
})

export const toggleTerminal = async () => {
  terminal.open = !terminal.open

  if (terminal.open && session.tabs.length === 0) {
    await loadShells()
    openTab()
  }
}

export const managers = $state({ installed: [] as string[], loaded: false })

export const loadManagers = async () => {
  if (!managers.loaded) {
    managers.installed = await packageManagers().catch(() => [])
    managers.loaded = true
  }
}

export const fallbackManager = () =>
  managers.installed.find(name => name === terminalPrefs.packageManager) ??
  (managers.installed.includes("npm") ? "npm" : managers.installed[0]) ??
  "npm"

const SHELL_SPECIAL = [" ", "&", "|", ";", "<", ">", "(", ")", "^", "%", "$"]

export const scriptCommand = (manager: string, script: string) => {
  const name = SHELL_SPECIAL.some(char => script.includes(char))
    ? `"${script}"`
    : script

  return manager === "deno" ? `deno task ${name}` : `${manager} run ${name}`
}

export const runInTerminal = async (cwd: string, command: string) => {
  await loadShells()
  terminal.open = true
  openTab({ cwd, run: command })
}
