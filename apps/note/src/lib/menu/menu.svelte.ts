export type MenuAction = {
  label: string
  icon?: string
  keys?: string
  danger?: boolean
  disabled?: boolean
  run: () => unknown
}

export type MenuItem = MenuAction | "separator"

type Open = { x: number; y: number; items: MenuItem[] }

export const menu = $state({ at: null as Open | null })

let back: HTMLElement | null = null

export const showMenu = (event: MouseEvent, items: MenuItem[]) => {
  event.preventDefault()
  event.stopPropagation()

  if (!menu.at) {
    const focused = document.activeElement

    back = focused instanceof HTMLElement ? focused : null
  }

  menu.at = { x: event.clientX, y: event.clientY, items }
}

export const closeMenu = () => {
  const target = back

  menu.at = null
  back = null
  target?.focus({ preventScroll: true })
}

export const contextmenu = (node: HTMLElement, items: () => MenuItem[]) => {
  let current = items

  const show = (event: MouseEvent) => showMenu(event, current())

  node.addEventListener("contextmenu", show)

  return {
    update: (next: () => MenuItem[]) => {
      current = next
    },
    destroy: () => node.removeEventListener("contextmenu", show),
  }
}
