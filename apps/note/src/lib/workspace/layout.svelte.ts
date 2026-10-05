import { type KeyValueStore, openStore } from "../platform/storage"

export type PanelId = "files" | "search" | "backlinks" | "outline"

export type Side = "left" | "right"

export type ActionId =
  | "new-note"
  | "new-canvas"
  | "graph"
  | "calendar"
  | "todos"
  | "palette"

export type PaletteMode =
  | "commands"
  | "files"
  | "insert-template"
  | "new-template"
  | "cite-note"

type Saved = {
  docks: Record<Side, PanelId[]>
  actions: ActionId[]
  width: Record<Side, number>
}

export const PANELS: Record<PanelId, { label: string; icon: string }> = {
  files: { label: "파일", icon: "lucide:folder-tree" },
  search: { label: "검색", icon: "lucide:search" },
  backlinks: { label: "백링크", icon: "lucide:link-2" },
  outline: { label: "개요", icon: "lucide:list-tree" },
}

const DEFAULTS = (): Saved => ({
  docks: { left: ["files", "search"], right: ["backlinks", "outline"] },
  actions: ["new-note", "new-canvas", "graph", "calendar", "todos", "palette"],
  width: { left: 16, right: 16 },
})

const FILE = "settings.json"
const KEY = "layout"
const MIN_WIDTH = 12
const MAX_WIDTH = 36

const wide = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(min-width: 64rem)").matches

const initial = DEFAULTS()

export const layout = $state({
  ...initial,
  open: { left: wide(), right: wide() } as Record<Side, boolean>,
  active: {
    left: initial.docks.left[0],
    right: initial.docks.right[0],
  } as Record<Side, PanelId | null>,
  palette: null as PaletteMode | null,
  todoDay: null as string | null,
  citeInto: null as ((path: string) => void) | null,
})

export const sideOf = (panel: PanelId): Side =>
  layout.docks.left.includes(panel) ? "left" : "right"

export const showPanel = (panel: PanelId) => {
  const side = sideOf(panel)

  layout.open[side] = !(layout.open[side] && layout.active[side] === panel)
  layout.active[side] = panel
}

export const revealPanel = (panel: PanelId) => {
  const side = sideOf(panel)

  layout.open[side] = true
  layout.active[side] = panel
}

export const movePanel = (panel: PanelId, side: Side, before?: PanelId) => {
  for (const dock of ["left", "right"] as const) {
    layout.docks[dock] = layout.docks[dock].filter(p => p !== panel)

    if (layout.active[dock] === panel) {
      layout.active[dock] = layout.docks[dock][0] ?? null
    }
  }

  const target = layout.docks[side]
  const at = before ? target.indexOf(before) : -1

  target.splice(at === -1 ? target.length : at, 0, panel)
  layout.active[side] = panel
  layout.open[side] = true
}

export const moveAction = (action: ActionId, before: ActionId | null) => {
  const rest = layout.actions.filter(a => a !== action)
  const at = before ? rest.indexOf(before) : -1

  rest.splice(at === -1 ? rest.length : at, 0, action)
  layout.actions = rest
}

export const resizeSide = (side: Side, rem: number) => {
  layout.width[side] = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, rem))
}

export const closePanelsOnNarrow = () => {
  if (!wide()) {
    layout.open.left = false
    layout.open.right = false
  }
}

export const resetLayout = () => {
  const fresh = DEFAULTS()

  layout.docks = fresh.docks
  layout.actions = fresh.actions
  layout.width = fresh.width
  layout.active = { left: fresh.docks.left[0], right: fresh.docks.right[0] }
}

let handle: Promise<KeyValueStore> | undefined

const store = () => {
  handle ??= openStore(FILE)

  return handle
}

const known = <T extends string>(values: unknown, allowed: readonly T[]) =>
  Array.isArray(values)
    ? values.filter((v): v is T => allowed.includes(v as T))
    : []

export const restoreLayout = async () => {
  const saved = await (await store()).get<Partial<Saved>>(KEY)
  const fresh = DEFAULTS()

  if (!saved) {
    return
  }

  const panels = Object.keys(PANELS) as PanelId[]
  const left = known(saved.docks?.left, panels)
  const right = known(saved.docks?.right, panels).filter(p => !left.includes(p))
  const missing = panels.filter(p => !left.includes(p) && !right.includes(p))
  const actions = known(saved.actions, fresh.actions)

  layout.docks = { left: [...left, ...missing], right }
  layout.actions = [
    ...actions,
    ...fresh.actions.filter(a => !actions.includes(a)),
  ]
  layout.width = { ...fresh.width, ...saved.width }
  layout.active = {
    left: layout.docks.left[0] ?? null,
    right: right[0] ?? null,
  }
}

export const persistLayout = async () => {
  const db = await store()
  const { docks, actions, width } = $state.snapshot(layout)

  await db.set(KEY, { docks, actions, width } satisfies Saved)
  await db.save()
}
