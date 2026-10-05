import { type KeyValueStore, openStore } from "../platform/storage"
import { stem } from "../vault/paths"

export type ViewKind =
  | "note"
  | "canvas"
  | "graph"
  | "calendar"
  | "todos"
  | "settings"

export type Tab = { id: string; kind: ViewKind; path: string | null }

export type Pane = { id: string; tabs: Tab[]; active: string | null }

type Saved = { panes: Pane[]; focus: string }

const FILE = "settings.json"
const KEY = "workspace"
const SINGLETONS: ViewKind[] = ["graph", "calendar", "todos", "settings"]

const LABELS: Record<ViewKind, string> = {
  note: "노트",
  canvas: "캔버스",
  graph: "그래프",
  calendar: "캘린더",
  todos: "할 일",
  settings: "설정",
}

const ICONS: Record<ViewKind, string> = {
  note: "lucide:file-text",
  canvas: "lucide:layout-dashboard",
  graph: "lucide:waypoints",
  calendar: "lucide:calendar-days",
  todos: "lucide:list-checks",
  settings: "lucide:settings",
}

const newId = () => crypto.randomUUID()

const emptyPane = (): Pane => ({ id: newId(), tabs: [], active: null })

const first = emptyPane()

export const workspace = $state({
  panes: [first] as Pane[],
  focus: first.id,
})

export const tabTitle = (tab: Tab) =>
  tab.path ? stem(tab.path) : LABELS[tab.kind]

export const tabIcon = (tab: Tab) => ICONS[tab.kind]

export const activeTab = (pane: Pane) =>
  pane.tabs.find(t => t.id === pane.active) ?? null

export const focusedPane = () =>
  workspace.panes.find(p => p.id === workspace.focus) ?? workspace.panes[0]

export const focusedTab = () => activeTab(focusedPane())

export const focusPane = (id: string) => {
  workspace.focus = id
}

export const activate = (pane: Pane, tabId: string) => {
  pane.active = tabId
  workspace.focus = pane.id
}

export type OpenOptions = { newTab?: boolean; split?: boolean }

export const openView = (
  kind: ViewKind,
  path: string | null = null,
  options: OpenOptions = {},
) => {
  const existing = workspace.panes
    .flatMap(pane => pane.tabs.map(tab => ({ pane, tab })))
    .find(({ tab }) =>
      SINGLETONS.includes(kind) ? tab.kind === kind : tab.path === path,
    )

  if (existing && !options.split) {
    activate(existing.pane, existing.tab.id)

    return
  }

  const tab: Tab = { id: newId(), kind, path }

  if (options.split) {
    const pane: Pane = { id: newId(), tabs: [tab], active: tab.id }
    const at = workspace.panes.findIndex(p => p.id === workspace.focus)

    workspace.panes.splice(at + 1, 0, pane)
    workspace.focus = pane.id

    return
  }

  const pane = focusedPane()
  const current = activeTab(pane)
  const replace =
    !options.newTab &&
    current !== null &&
    (current.kind === "note" || current.kind === "canvas") &&
    (kind === "note" || kind === "canvas")

  if (replace && current) {
    current.kind = kind
    current.path = path
  } else {
    pane.tabs.push(tab)
    pane.active = tab.id
  }

  workspace.focus = pane.id
}

export const splitPane = (pane: Pane) => {
  const tab = activeTab(pane)

  focusPane(pane.id)
  openView(tab?.kind ?? "calendar", tab?.path ?? null, { split: true })
}

export const closeTab = (pane: Pane, tabId: string) => {
  const at = pane.tabs.findIndex(t => t.id === tabId)

  if (at === -1) {
    return
  }

  pane.tabs.splice(at, 1)

  if (pane.active === tabId) {
    pane.active = pane.tabs[Math.min(at, pane.tabs.length - 1)]?.id ?? null
  }

  if (pane.tabs.length === 0 && workspace.panes.length > 1) {
    const index = workspace.panes.indexOf(pane)

    workspace.panes.splice(index, 1)

    if (workspace.focus === pane.id) {
      workspace.focus = workspace.panes[Math.max(0, index - 1)].id
    }
  }
}

export const closeOthers = (pane: Pane, keep: string) => {
  pane.tabs = pane.tabs.filter(t => t.id === keep)
  pane.active = keep
}

export const moveTab = (tabId: string, target: Pane, before: string | null) => {
  const source = workspace.panes.find(p => p.tabs.some(t => t.id === tabId))
  const tab = source?.tabs.find(t => t.id === tabId)

  if (!source || !tab || tabId === before) {
    return
  }

  source.tabs.splice(source.tabs.indexOf(tab), 1)

  const at = before ? target.tabs.findIndex(t => t.id === before) : -1

  target.tabs.splice(at === -1 ? target.tabs.length : at, 0, tab)
  target.active = tab.id
  workspace.focus = target.id

  if (source !== target) {
    if (source.active === tabId) {
      source.active = source.tabs[0]?.id ?? null
    }

    if (source.tabs.length === 0 && workspace.panes.length > 1) {
      workspace.panes.splice(workspace.panes.indexOf(source), 1)
    }
  }
}

export const retarget = (from: string, to: string) => {
  for (const pane of workspace.panes) {
    for (const tab of pane.tabs) {
      if (tab.path === from || tab.path?.startsWith(`${from}/`)) {
        tab.path = to + tab.path.slice(from.length)
      }
    }
  }
}

export const forget = (path: string) => {
  for (const pane of [...workspace.panes]) {
    for (const tab of [...pane.tabs]) {
      if (tab.path === path || tab.path?.startsWith(`${path}/`)) {
        closeTab(pane, tab.id)
      }
    }
  }
}

let handle: Promise<KeyValueStore> | undefined

const store = () => {
  handle ??= openStore(FILE)

  return handle
}

export const restoreWorkspace = async () => {
  const saved = await (await store()).get<Saved>(KEY)
  const panes = saved?.panes.filter(p => Array.isArray(p.tabs)) ?? []

  if (panes.length === 0) {
    openView("calendar")

    return
  }

  workspace.panes = panes
  workspace.focus = panes.some(p => p.id === saved?.focus)
    ? (saved?.focus ?? panes[0].id)
    : panes[0].id
}

export const persistWorkspace = async () => {
  const db = await store()

  await db.set(KEY, $state.snapshot(workspace) satisfies Saved)
  await db.save()
}
