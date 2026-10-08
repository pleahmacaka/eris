import { getCurrentWindow } from "@tauri-apps/api/window"
import { untrack } from "svelte"
import { kill, type Shell, shells } from "../pty"
import {
  insert,
  isSplit,
  type Layout,
  mapPanes,
  newId,
  type Pane,
  panesOf,
  remove,
  renumber,
  type Side,
} from "./layout"
import { prefs } from "./prefs.svelte"
import { newWindow } from "./windows"

export type Tab = {
  id: number
  root: Layout
  focus: number
  sync: boolean
  name?: string
}

export type Handoff = { root: Layout; name?: string }

export type Host = {
  shell: () => string
  cwd: () => string | null
  empty: () => void
}

export const session = $state({
  shells: [] as Shell[],
  tabs: [] as Tab[],
  active: 0,
  settingsOpen: false,
})

export const defaultShell = (preferred: string | null) =>
  session.shells.find(shell => shell.id === preferred)?.id ??
  session.shells[0]?.id ??
  "cmd"

let host: Host = {
  shell: () => defaultShell(prefs.shell),
  cwd: () => null,
  empty: () => getCurrentWindow().close(),
}

export const setHost = (next: Host) => {
  host = next
}

export const loadShells = async () => {
  if (untrack(() => session.shells.length) === 0) {
    session.shells = await shells().catch(() => [])
  }
}

export const shellName = (id: string) =>
  session.shells.find(shell => shell.id === id)?.name ?? id

const newPane = (shell: string, cwd: string | null): Pane => ({
  id: newId(),
  shell,
  cwd,
  pty: null,
  title: shellName(shell),
})

const killPanes = (root: Layout) => {
  for (const pane of panesOf(root)) {
    if (pane.pty !== null) {
      kill(pane.pty)
    }
  }
}

export const paneLabel = (pane: Pane) => pane.name || pane.title

export const titleOf = (tab: Tab) => {
  const pane = panesOf(tab.root).find(entry => entry.id === tab.focus)

  return pane ? paneLabel(pane) : ""
}

export const tabOf = (paneId: number) =>
  session.tabs.find(tab => panesOf(tab.root).some(pane => pane.id === paneId))

export const bindPty = (paneId: number, pty: number) => {
  const pane = session.tabs
    .flatMap(tab => panesOf(tab.root))
    .find(entry => entry.id === paneId)

  if (pane) {
    pane.pty = pty
  } else {
    kill(pty)
  }
}

const tabFor = (root: Layout, name?: string): Tab => ({
  id: newId(),
  root,
  focus: panesOf(root)[0].id,
  sync: false,
  name,
})

const pushTab = (root: Layout, name?: string) => {
  session.tabs.push(tabFor(root, name))
  session.active = session.tabs.length - 1
}

export const openTab = ({
  shell = host.shell(),
  cwd = host.cwd(),
}: {
  shell?: string
  cwd?: string | null
} = {}) => {
  pushTab(newPane(shell, cwd))
}

export const adoptTab = ({ root, name }: Handoff) => {
  pushTab(renumber(root), name)
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

  session.tabs.splice(index + 1, 0, tabFor(pane))
  session.active = index + 1
}

export const ungroup = (tab: Tab) => {
  for (const pane of panesOf(tab.root).slice(1).reverse()) {
    detachPane(pane.id)
  }

  session.active = session.tabs.indexOf(tab)
}

const removeTab = (index: number) => {
  session.tabs.splice(index, 1)
  session.active = Math.min(
    session.active,
    Math.max(0, session.tabs.length - 1),
  )

  if (session.tabs.length === 0) {
    host.empty()
  }
}

export const closeTab = (index: number) => {
  const tab = session.tabs[index]

  if (tab) {
    killPanes(tab.root)
    removeTab(index)
  }
}

export const popOut = async () => {
  const tab = session.tabs[session.active]

  if (!tab) {
    return
  }

  const handoff: Handoff = $state.snapshot({ root: tab.root, name: tab.name })

  removeTab(session.active)

  await newWindow(null, handoff).catch((reason: unknown) => {
    killPanes(handoff.root)

    throw reason
  })
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

  const pane = newPane(focused.shell, focused.cwd)

  tab.root = insert(tab.root, focused.id, side, pane)
  tab.focus = pane.id
}

export const closePane = (paneId: number) => {
  const tab = tabOf(paneId)
  const pane = tab && panesOf(tab.root).find(entry => entry.id === paneId)

  if (!tab || !pane) {
    return
  }

  const left = remove(tab.root, paneId)

  if (!left) {
    closeTab(session.tabs.indexOf(tab))

    return
  }

  killPanes(pane)
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
