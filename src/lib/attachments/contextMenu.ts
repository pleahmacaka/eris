import type { Attachment } from "svelte/attachments"
import type { MenuSection } from "#lib/menu/items.js"
import { contextMenuStore } from "#lib/store/contextMenu.svelte.js"

export const contextMenu =
  (sections: () => MenuSection[]): Attachment<HTMLElement> =>
  node => {
    const offer = (event: MouseEvent) => contextMenuStore.offer(event, sections)

    node.addEventListener("contextmenu", offer)

    return () => node.removeEventListener("contextmenu", offer)
  }

export const menuButton =
  (sections: () => MenuSection[]): Attachment<HTMLElement> =>
  node => {
    let wasOpen = false

    const remember = () => {
      wasOpen = contextMenuStore.open?.source === node
    }
    const toggle = () => {
      if (!wasOpen) {
        const { left, bottom } = node.getBoundingClientRect()

        contextMenuStore.show(sections(), { x: left, y: bottom }, node)
      }

      wasOpen = false
    }

    node.addEventListener("pointerdown", remember)
    node.addEventListener("click", toggle)

    return () => {
      node.removeEventListener("pointerdown", remember)
      node.removeEventListener("click", toggle)
    }
  }
