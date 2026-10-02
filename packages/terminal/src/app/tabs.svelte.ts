import { getCurrentWindow } from "@tauri-apps/api/window"
import type { Shell } from "../pty"

export type Tab = {
  id: number
  shell: string
  cwd: string | null
  title: string
}

let next = 1

export const session = $state({
  shells: [] as Shell[],
  tabs: [] as Tab[],
  active: 0,
  settingsOpen: false,
})

export const shellName = (id: string) =>
  session.shells.find(shell => shell.id === id)?.name ?? id

export const openTab = (shell: string, cwd: string | null = null) => {
  session.tabs.push({ id: next++, shell, cwd, title: shellName(shell) })
  session.active = session.tabs.length - 1
}

export const closeTab = (index: number) => {
  session.tabs.splice(index, 1)
  session.active = Math.min(
    session.active,
    Math.max(0, session.tabs.length - 1),
  )

  if (session.tabs.length === 0) {
    getCurrentWindow().close()
  }
}

export const cycleTab = (step: number) => {
  const count = session.tabs.length

  if (count > 0) {
    session.active = (session.active + step + count) % count
  }
}
