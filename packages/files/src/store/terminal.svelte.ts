import { DEFAULT_FONT, loadShells, openTab, session } from "@eris/terminal"
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
  position: null as TerminalPosition | null,
})

export const toggleTerminal = async () => {
  terminal.open = !terminal.open

  if (terminal.open && session.tabs.length === 0) {
    await loadShells()
    openTab()
  }
}
