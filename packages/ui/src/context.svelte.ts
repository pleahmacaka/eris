import type { MenuItem } from "./menu"

type Request = {
  items: MenuItem[]
  x: number
  y: number
  placement?: "up" | "down"
}

export const contextMenu = $state<{ request: Request | null }>({
  request: null,
})

export const openContextMenu = (request: Request) => {
  contextMenu.request = request
}

export const closeContextMenu = () => {
  contextMenu.request = null
}
