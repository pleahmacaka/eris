import { editing } from "$lib/edit"
import { hideWindow } from "$lib/native/windows"
import type { Launcher } from "./launcher.svelte"

const PAGE = 5

export const keydown = (launcher: Launcher, e: KeyboardEvent) => {
  if (launcher.menu) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()

      const count = launcher.menuItems.length
      const step = e.key === "ArrowDown" ? 1 : count - 1

      launcher.menuCursor = (launcher.menuCursor + step) % count
    } else if (e.key === "Enter") {
      e.preventDefault()
      launcher.runMenu(launcher.menuItems[launcher.menuCursor])
    } else if (e.key === "Escape") {
      e.preventDefault()
      launcher.menu = null
    }

    return
  }

  if (e.altKey && e.key >= "1" && e.key <= "9") {
    e.preventDefault()
    launcher.run(launcher.flat[Number(e.key) - 1])

    return
  }

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault()
      launcher.move(1)

      return
    case "ArrowUp":
      e.preventDefault()
      launcher.move(-1)

      return
    case "PageDown":
      e.preventDefault()
      launcher.cursor = Math.max(
        0,
        Math.min(launcher.active + PAGE, launcher.flat.length - 1),
      )

      return
    case "PageUp":
      e.preventDefault()
      launcher.cursor = Math.max(launcher.active - PAGE, 0)

      return
    case "Tab":
      e.preventDefault()
      launcher.jumpGroup(e.shiftKey ? -1 : 1)

      return
    case "Enter":
      e.preventDefault()
      launcher.run(
        launcher.flat[launcher.active],
        e.shiftKey ? "admin" : e.ctrlKey ? "location" : "open",
      )

      return
    case "Escape":
      e.preventDefault()

      if (launcher.query) {
        launcher.setQuery("")
      } else {
        launcher.hide()
      }

      return
    case "ContextMenu":
      e.preventDefault()
      launcher.openMenuAtActive()

      return
  }

  const typing = e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey

  if (typing && document.activeElement !== launcher.input) {
    launcher.input?.focus()
  }
}

export const mousedown = (launcher: Launcher, e: MouseEvent) => {
  const target = e.target as Element

  if (launcher.menu && !target.closest("[data-menu]")) {
    launcher.menu = null

    return
  }

  if (launcher.backdropMenu) {
    return
  }

  if (e.button === 0 && !editing.on && !target.closest("[data-launcher]")) {
    hideWindow("main").catch(() => undefined)
  }
}

export const contextmenu = (launcher: Launcher, e: MouseEvent) => {
  if ((e.target as Element).closest("[data-launcher]")) {
    return
  }

  e.preventDefault()
  e.stopPropagation()
  launcher.backdropMenuX = e.clientX
  launcher.backdropMenuY = e.clientY
  launcher.backdropMenu = true
}
