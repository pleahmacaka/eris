import type { MenuItem } from "../menus/menu"

export type ContextMenuRequest = {
  items: MenuItem[]
  x: number
  y: number
  placement?: "up" | "down"
  anchor?: Element
}

export type MenuPresenter = {
  readonly ready: boolean
  show: (request: ContextMenuRequest, dense: boolean) => void
  key: (key: string) => void
  hide: () => void
}

export const contextMenu = $state<{
  request: ContextMenuRequest | null
  presenter: MenuPresenter | null
}>({
  request: null,
  presenter: null,
})

export const openContextMenu = (request: ContextMenuRequest) => {
  const reopened =
    request.anchor !== undefined &&
    contextMenu.request?.anchor === request.anchor

  contextMenu.request = reopened ? null : request
}

export const closeContextMenu = () => {
  contextMenu.request = null
}
