import { getCurrentWindow } from "@tauri-apps/api/window"
import type { Shell } from "../pty"
import {
  insert,
  isSplit,
  type Layout,
  mapPanes,
  newId,
  type Pane,
  panesOf,
  remove,
  type Side,
} from "./layout"

export type Tab = {
  id: number
  root: Layout
  focus: number
  sync: boolean
}

export const session = $state({
  shells: [] as Shell[],
  tabs: [] as Tab[],
  active: 0,
  settingsOpen: false,
})

export const shellName = (id: string) =>
  session.shells.find(shell => shell.id === id)?.name ?? id

const newPane = (shell: string, cwd: string | null = null): Pane => ({
  id: newId(),
  shell,
  cwd,
  title: shellName(shell),
})

export const titleOf = (tab: Tab) =>
  panesOf(tab.root).find(pane => pane.id === tab.focus)?.title ?? ""

export const tabOf = (paneId: number) =>
  session.tabs.find(tab => panesOf(tab.root).some(pane => pane.id === paneId))

export const openTab = (shell: string, cwd: string | null = null) => {
  const pane = newPane(shell, cwd)

  session.tabs.push({ id: newId(), root: pane, focus: pane.id, sync: false })
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

export const splitPane = (tab: Tab, side: Side) => {
  const focused = panesOf(tab.root).find(pane => pane.id === tab.focus)

  if (!focused) {
    return
  }

  const pane = newPane(focused.shell)

  tab.root = insert(tab.root, focused.id, side, pane)
  tab.focus = pane.id
}

export const closePane = (paneId: number) => {
  const tab = tabOf(paneId)

  if (!tab) {
    return
  }

  const left = remove(tab.root, paneId)

  if (!left) {
    closeTab(session.tabs.indexOf(tab))

    return
  }

  tab.root = left

  if (tab.focus === paneId) {
    tab.focus = panesOf(left)[0].id
  }
}

export const dropTab = (
  sourceId: number,
  target: Pane,
  side: Side | "center",
) => {
  const into = session.tabs[session.active]
  const source = session.tabs.find(tab => tab.id === sourceId)

  if (!into || !source || source === into) {
    return
  }

  if (side === "center") {
    if (isSplit(source.root)) {
      return
    }

    const moved = source.root

    into.root = mapPanes(into.root, pane =>
      pane.id === target.id ? moved : pane,
    )
    into.focus = moved.id
    source.root = target
    source.focus = target.id

    return
  }

  into.root = insert(into.root, target.id, side, source.root)
  into.focus = source.focus
  session.tabs.splice(session.tabs.indexOf(source), 1)
  session.active = session.tabs.indexOf(into)
}
