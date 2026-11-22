import type { MenuSection } from "#lib/menu/items.js"
import type { Point } from "#lib/menu/position.js"

export type OpenMenu = {
  id: number
  sections: MenuSection[]
  point: Point
  origin: HTMLElement | null
  source: Element | null
  layer: HTMLElement | null
}

class ContextMenuStore {
  open = $state.raw<OpenMenu | null>(null)

  private serial = 0
  private offers = new WeakMap<Event, MenuSection[]>()

  offer(event: Event, sections: () => MenuSection[]) {
    if (!this.offers.has(event)) {
      this.offers.set(event, sections())
    }
  }

  offered(event: Event) {
    return this.offers.get(event) ?? []
  }

  show(sections: MenuSection[], point: Point, source: Element | null = null) {
    if (!sections.some(section => section.length > 0)) {
      this.close()

      return
    }

    const focused = this.open?.origin ?? document.activeElement

    this.serial += 1
    this.open = {
      id: this.serial,
      sections,
      point,
      origin: focused instanceof HTMLElement ? focused : null,
      source,
      layer: source?.closest("dialog") ?? null,
    }
  }

  close(restoreFocus = false) {
    const origin = this.open?.origin

    this.open = null

    if (restoreFocus && origin?.isConnected) {
      origin.focus({ preventScroll: true })
    }
  }
}

export const contextMenuStore = new ContextMenuStore()
