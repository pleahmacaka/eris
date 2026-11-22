export type Box = { left: number; top: number; right: number; bottom: number }

export type Size = { width: number; height: number }

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

export const placeBeside = (
  anchor: Box,
  card: Size,
  viewport: Size,
  gap: number,
) => {
  const right = anchor.right + gap
  const left = anchor.left - gap - card.width
  const fitsRight = right + card.width <= viewport.width - gap

  return {
    left: clamp(
      fitsRight || left < gap ? right : left,
      gap,
      viewport.width - gap - card.width,
    ),
    top: clamp(anchor.top, gap, viewport.height - gap - card.height),
  }
}
