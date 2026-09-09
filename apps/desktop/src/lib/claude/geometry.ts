export type Rect = { x: number; y: number; width: number; height: number }

export type Point = { left: number; top: number }

export type Corner = { right: boolean; bottom: boolean }

export const px = (rem: number, unit: number) => Math.round(rem * unit)

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(min, value), max)

export const sizesOf = (unit: number) => {
  const bubble = px(3.5, unit)
  const stackGap = px(0.375, unit)

  return {
    bubble,
    stackGap,
    step: bubble + stackGap,
    plus: px(1.25, unit),
    attach: px(1.75, unit),
    tipGap: px(0.5, unit),
    // ponytail: fixed panel size, add resizing when threads need more room
    panelWidth: px(27.5, unit),
    panelHeight: px(40, unit),
    gap: px(0.75, unit),
    edge: px(0.5, unit),
    target: px(4, unit),
    targetBottom: px(3.5, unit),
    catch: px(7.5, unit),
    slop: px(0.2, unit),
  }
}

export type Sizes = ReturnType<typeof sizesOf>

export const monitorAt = (
  monitors: Rect[],
  x: number,
  y: number,
  fallback: Rect,
) =>
  monitors.find(
    m => x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height,
  ) ??
  monitors.reduce<Rect | null>((best, m) => {
    const distance = Math.hypot(m.x + m.width / 2 - x, m.y + m.height / 2 - y)

    return best &&
      Math.hypot(best.x + best.width / 2 - x, best.y + best.height / 2 - y) <=
        distance
      ? best
      : m
  }, null) ??
  fallback

export const layoutOf = <T extends Point & { id: string; stack: string }>(
  bubbles: T[],
  step: number,
) => {
  const out = new Map<string, Point>()
  const heads = new Map<string, Point & { count: number }>()

  for (const b of bubbles) {
    const head = heads.get(b.stack)

    if (head) {
      out.set(b.id, { left: head.left, top: head.top + head.count * step })
      head.count += 1
    } else {
      heads.set(b.stack, { left: b.left, top: b.top, count: 1 })
      out.set(b.id, { left: b.left, top: b.top })
    }
  }

  return out
}

const snapAxis = (
  fraction: number,
  value: number,
  snap: number,
  min: number,
  max: number,
) => clamp(fraction < snap ? min : fraction > 1 - snap ? max : value, min, max)

export type SettleOptions = {
  monitors: Rect[]
  fallback: Rect
  snap: number
  bubble: number
  edge: number
}

export const settleAt = (
  head: Point,
  height: number,
  { monitors, fallback, snap, bubble, edge }: SettleOptions,
) => {
  const centerX = head.left + bubble / 2
  const centerY = head.top + height / 2
  const m = monitorAt(monitors, centerX, centerY, fallback)
  const fromLeft = (centerX - m.x) / m.width
  const fromTop = (centerY - m.y) / m.height

  return {
    corner: { right: fromLeft >= 0.5, bottom: fromTop >= 0.5 } as Corner,
    left: snapAxis(
      fromLeft,
      head.left,
      snap,
      m.x + edge,
      m.x + m.width - bubble - edge,
    ),
    top: snapAxis(
      fromTop,
      head.top,
      snap,
      m.y + edge,
      m.y + m.height - height - edge,
    ),
  }
}
