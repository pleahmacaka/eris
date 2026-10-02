export const rootRem = () =>
  Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

export const track = (
  e: PointerEvent,
  move: (next: PointerEvent) => void,
  done: () => void = () => undefined,
) => {
  const target = e.currentTarget as HTMLElement
  const id = e.pointerId

  target.setPointerCapture(id)

  const stop = () => {
    if (target.hasPointerCapture(id)) {
      target.releasePointerCapture(id)
    }

    target.removeEventListener("pointermove", move)
    target.removeEventListener("pointerup", stop)
    target.removeEventListener("pointercancel", stop)
    done()
  }

  target.addEventListener("pointermove", move)
  target.addEventListener("pointerup", stop)
  target.addEventListener("pointercancel", stop)

  return stop
}

type Resize = {
  axis: "x" | "y"
  invert?: boolean
  min: number
  max: number
  get: () => number
  set: (rem: number) => void
}

export const snapRem = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value * 4) / 4))

export const resizeHandle =
  ({ axis, invert = false, min, max, get, set }: Resize) =>
  (e: PointerEvent) => {
    e.stopPropagation()

    const rem = rootRem()
    const at = (event: PointerEvent) =>
      axis === "x" ? event.clientX : event.clientY
    const start = at(e)
    const size = get()

    track(e, next => {
      const delta = ((at(next) - start) / rem) * (invert ? -1 : 1)

      set(snapRem(size + delta, min, max))
    })
  }
