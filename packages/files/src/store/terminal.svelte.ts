import { DEFAULT_FONT, type Shell, shells } from "@eris/terminal"
import { persisted } from "./persisted.svelte"

export type TerminalPosition = "bottom" | "side"

export type TerminalPrefs = {
  position: TerminalPosition
  shell: string | null
  fontFamily: string
  height: number
  width: number
}

export const terminalPrefs = persisted<TerminalPrefs>("eris-files.terminal", {
  position: "bottom",
  shell: null,
  fontFamily: DEFAULT_FONT,
  height: 16,
  width: 30,
})

export const terminal = $state({
  open: false,
  session: 0,
  exited: false,
  cwd: null as string | null,
  shells: [] as Shell[],
})

export const loadShells = async () => {
  if (terminal.shells.length === 0) {
    terminal.shells = await shells().catch(() => [])
  }

  return terminal.shells
}

export const shellFor = () =>
  terminal.shells.find(shell => shell.id === terminalPrefs.shell)?.id ??
  terminal.shells[0]?.id ??
  "cmd"

export const startTerminal = async (cwd: string | null) => {
  await loadShells()

  terminal.cwd = cwd
  terminal.exited = false
  terminal.session++
  terminal.open = true
}

export const toggleTerminal = (cwd: string | null) => {
  if (terminal.open) {
    terminal.open = false
  } else if (terminal.session === 0 || terminal.exited) {
    startTerminal(cwd)
  } else {
    terminal.open = true
  }
}
