export { registerTerminalMessages } from "./app/i18n"
export { sessionShortcut } from "./app/keys"
export { default as PaneArea } from "./app/PaneArea.svelte"
export { type Prefs, prefs } from "./app/prefs.svelte"
export { default as TabStrip } from "./app/TabStrip.svelte"
export { default as TerminalApp } from "./app/TerminalApp.svelte"
export {
  defaultShell,
  loadShells,
  openTab,
  popOut,
  session,
  setHost,
} from "./app/tabs.svelte"
export { newWindow as newTerminalWindow } from "./app/windows"
export type { Shell } from "./pty"
export { DEFAULT_FONT, fontStack } from "./ready"
export { terminalTheme } from "./theme"
