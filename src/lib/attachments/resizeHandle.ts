import type { Attachment } from "svelte/attachments"

type ResizeHandle = {
  edge: "start" | "end"
  ongrab: () => void
  onresize: (width: number) => void
  oncommit: () => void
  onreset: () => void
}

const KEY_STEP = 16

export const resizeHandle =
  ({
    edge,
    ongrab,
    onresize,
    oncommit,
    onreset,
  }: ResizeHandle): Attachment<HTMLElement> =>
  node => {
    const panel = node.parentElement

    if (!panel) {
      return
    }

    let drag: { x: number; width: number; direction: number } | null = null

    const width = () => panel.getBoundingClientRect().width
    const direction = () =>
      (edge === "end" ? 1 : -1) *
      (getComputedStyle(node).direction === "rtl" ? -1 : 1)

    const grab = (event: PointerEvent) => {
      if (event.button !== 0) {
        return
      }

      event.preventDefault()
      ongrab()
      drag = { x: event.clientX, width: width(), direction: direction() }
      node.dataset.dragging = ""
      node.setPointerCapture(event.pointerId)
    }

    const move = (event: PointerEvent) => {
      if (drag) {
        onresize(drag.width + (event.clientX - drag.x) * drag.direction)
      }
    }

    const release = () => {
      if (drag) {
        drag = null
        delete node.dataset.dragging
        oncommit()
      }
    }

    const nudge = (event: KeyboardEvent) => {
      const target = new Map([
        ["ArrowRight", width() + KEY_STEP * direction()],
        ["ArrowLeft", width() - KEY_STEP * direction()],
        ["Home", 0],
        ["End", Number.POSITIVE_INFINITY],
      ]).get(event.key)

      if (target !== undefined) {
        event.preventDefault()
        ongrab()
        onresize(target)
        oncommit()
      }
    }

    node.tabIndex = 0
    node.addEventListener("pointerdown", grab)
    node.addEventListener("pointermove", move)
    node.addEventListener("lostpointercapture", release)
    node.addEventListener("keydown", nudge)
    node.addEventListener("dblclick", onreset)

    return () => {
      node.removeEventListener("pointerdown", grab)
      node.removeEventListener("pointermove", move)
      node.removeEventListener("lostpointercapture", release)
      node.removeEventListener("keydown", nudge)
      node.removeEventListener("dblclick", onreset)
    }
  }
