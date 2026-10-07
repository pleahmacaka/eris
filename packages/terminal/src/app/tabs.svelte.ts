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
  name?: string
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

export const paneLabel = (pane: Pane) => pane.name || pane.title

export const titleOf = (tab: Tab) => {
  const pane = panesOf(tab.root).find(entry => entry.id === tab.focus)

  return pane ? paneLabel(pane) : ""
}

export const tabOf = (paneId: number) =>
  session.tabs.find(tab => panesOf(tab.root).some(pane => pane.id === paneId))

export const openTab = (shell: string, cwd: string | null = null) => {
  const pane = newPane(shell, cwd)

  session.tabs.push({ id: newId(), root: pane, focus: pane.id, sync: false })
  session.active = session.tabs.length - 1
}

const insertTab = (index: number, pane: Pane) => {
  session.tabs.splice(index, 0, {
    id: newId(),
    root: pane,
    focus: pane.id,
    sync: false,
  })
}

export const detachPane = (paneId: number) => {
  const tab = tabOf(paneId)
  const pane = tab && panesOf(tab.root).find(entry => entry.id === paneId)
  const left = tab && remove(tab.root, paneId)

  if (!tab || !pane || !left) {
    return
  }

  const index = session.tabs.indexOf(tab)

  tab.root = left

  if (tab.focus === paneId) {
    tab.focus = panesOf(left)[0].id
  }

  insertTab(index + 1, pane)
  session.active = index + 1
}

export const ungroup = (tab: Tab) => {
  for (const pane of panesOf(tab.root).slice(1).reverse()) {
    detachPane(pane.id)
  }

  session.active = session.tabs.indexOf(tab)
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
