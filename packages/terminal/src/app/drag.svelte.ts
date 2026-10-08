export const SLOP = 6

export const drag = $state({ tab: null as number | null, x: 0, y: 0 })

let landing: ((tab: number) => void) | null = null

let settled = true

let spring: ReturnType<typeof setTimeout> | undefined

export const onTabDrop = (handler: (tab: number) => void) => {
  landing = handler

  return () => {
    landing = null
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

  const move = (m: PointerEvent) => {
    const far = Math.hypot(m.clientX - startX, m.clientY - startY) >= SLOP

    if (drag.tab === null && !far) {
      return
    }

    drag.tab = tab
    drag.x = m.clientX
    drag.y = m.clientY
  }

  const finish = (land: boolean) => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
    window.removeEventListener("keydown", cancel, true)
    unspring()

    if (drag.tab === null) {
      return
    }

    if (land) {
      landing?.(drag.tab)
    }

    drag.tab = null
    settled = false
    setTimeout(() => {
      settled = true
    })
  }

  const up = () => finish(true)

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
