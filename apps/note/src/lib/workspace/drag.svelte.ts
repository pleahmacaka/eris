const TYPES = {
  panel: "application/x-note-panel",
  action: "application/x-note-action",
  path: "application/x-note-path",
  tab: "application/x-note-tab",
} as const

export type DragKind = keyof typeof TYPES

export const drag = $state({ kind: null as DragKind | null })

export const startDrag = (event: DragEvent, kind: DragKind, value: string) => {
  if (!event.dataTransfer) {
    return
  }

  event.dataTransfer.setData(TYPES[kind], value)
  event.dataTransfer.effectAllowed = "move"
  drag.kind = kind
}

export const endDrag = () => {
  drag.kind = null
}

export const carries = (event: DragEvent, kind: DragKind) =>
  event.dataTransfer?.types.includes(TYPES[kind]) ?? false

export const accept = (event: DragEvent, ...kinds: DragKind[]) => {
  if (!kinds.some(kind => carries(event, kind))) {
    return false
  }

  event.preventDefault()

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move"
  }

  return true
}

export const payload = (event: DragEvent, kind: DragKind) =>
  event.dataTransfer?.getData(TYPES[kind]) ?? ""
