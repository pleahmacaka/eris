import { session, tearOff } from "./tabs.svelte"

export const SLOP = 6

export const drag = $state({ tab: null as number | null, x: 0, y: 0 })

const landings = new Set<(tab: number) => boolean>()

let settled = true

let spring: ReturnType<typeof setTimeout> | undefined

export const onTabDrop = (handler: (tab: number) => boolean) => {
  landings.add(handler)

  return () => {
    landings.delete(handler)
  }
}

export const justDragged = () => !settled

export const springTo = (target: number, open: () => void) => {
  clearTimeout(spring)

  if (drag.tab !== null && drag.tab !== target) {
    spring = setTimeout(open, 450)
  }
}

export const unspring = () => clearTimeout(spring)

export const pressTab = (e: PointerEvent, tab: number) => {
  if (e.button !== 0) {
    return
  }

  const startX = e.clientX
  const startY = e.clientY
  let lifted = false

  // the area shows the active tab, so dragging that tab needs a neighbor underneath to split
  const lift = () => {
    const index = session.tabs.findIndex(entry => entry.id === tab)

    if (index === session.active && session.tabs.length > 1) {
      lifted = true
      session.active = index < session.tabs.length - 1 ? index + 1 : index - 1
    }
  }

  const putBack = () => {
    if (lifted) {
      const index = session.tabs.findIndex(entry => entry.id === tab)

      if (index >= 0) {
        session.active = index
      }
    }
  }

  const move = (m: PointerEvent) => {
    const far = Math.hypot(m.clientX - startX, m.clientY - startY) >= SLOP

    if (drag.tab === null && !far) {
      return
    }

    if (drag.tab === null) {
      lift()
    }

    drag.tab = tab
    drag.x = m.clientX
    drag.y = m.clientY
  }

  const outside = (u: PointerEvent) =>
    u.clientX < 0 ||
    u.clientY < 0 ||
    u.clientX > window.innerWidth ||
    u.clientY > window.innerHeight

  const finish = (land: boolean, u?: PointerEvent) => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
    window.removeEventListener("keydown", cancel, true)
    unspring()

    if (drag.tab === null) {
      return
    }

    if (land && u && outside(u)) {
      tearOff(drag.tab).catch(() => undefined)
    } else if (!land || ![...landings].some(handler => handler(tab))) {
      putBack()
    }

    drag.tab = null
    settled = false
    setTimeout(() => {
      settled = true
    })
  }

  const up = (u: PointerEvent) => finish(true, u)

  const cancel = (k: KeyboardEvent) => {
    if (k.key === "Escape") {
      k.stopPropagation()
      finish(false)
    }
  }

  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", up)
  window.addEventListener("keydown", cancel, true)
}
