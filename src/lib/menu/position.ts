export type Point = { x: number; y: number }

export type Size = { width: number; height: number }

export type Bounds = {
  left: number
  top: number
  right: number
  bottom: number
}

export type Placement = Point & { origin: string }

const fit = (anchor: number, size: number, min: number, max: number) => {
  const start = anchor + size <= max ? anchor : anchor - size

  return Math.max(min, Math.min(start, max - size))
}

export const placeMenu = (
  anchor: Point,
  size: Size,
  bounds: Bounds,
  margin = 0,
): Placement => {
  const x = fit(
    anchor.x,
    size.width,
    bounds.left + margin,
    bounds.right - margin,
  )
  const y = fit(
    anchor.y,
    size.height,
    bounds.top + margin,
    bounds.bottom - margin,
  )
  const vertical = anchor.y < y + size.height / 2 ? "top" : "bottom"
  const horizontal = anchor.x < x + size.width / 2 ? "left" : "right"

  return { x, y, origin: `${vertical} ${horizontal}` }
}
