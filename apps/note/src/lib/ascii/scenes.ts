import type { Grid, Scene } from "./field"

type Point = { x: number; y: number; vx: number; vy: number }

const REACH = 16

const hash = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453

  return value - Math.floor(value)
}

const wrap = (value: number, size: number) => ((value % size) + size) % size

const stroke = (dx: number, dy: number) => {
  const angle = Math.abs(Math.atan2(dy, dx))

  if (angle < 0.4 || angle > Math.PI - 0.4) {
    return "-"
  }

  if (Math.abs(angle - Math.PI / 2) < 0.4) {
    return "|"
  }

  return dx > 0 === dy > 0 ? "\\" : "/"
}

export const constellation = (count = 22): Scene => {
  let points: Point[] = []

  const layout = (grid: Grid) => {
    points = Array.from({ length: count }, (_, i) => ({
      x: hash(i * 3 + 1) * grid.cols,
      y: hash(i * 7 + 2) * grid.rows,
      vx: (hash(i * 11 + 3) - 0.5) * 1.4,
      vy: (hash(i * 13 + 4) - 0.5) * 0.7,
    }))
  }

  const paint: Scene["paint"] = (put, grid, time) => {
    const at = points.map(p => ({
      col: wrap(p.x + p.vx * time, grid.cols),
      row: wrap(p.y + p.vy * time, grid.rows),
    }))

    for (let i = 0; i < at.length; i++) {
      for (let j = i + 1; j < at.length; j++) {
        const dx = at[j].col - at[i].col
        const dy = at[j].row - at[i].row
        const distance = Math.hypot(dx, dy * 2)

        if (distance > REACH) {
          continue
        }

        const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))
        const char = stroke(dx, dy)
        const alpha = 0.3 * (1 - distance / REACH)

        for (let s = 1; s < steps; s++) {
          put(
            Math.round(at[i].col + (dx * s) / steps),
            Math.round(at[i].row + (dy * s) / steps),
            char,
            alpha,
          )
        }
      }
    }

    at.forEach((p, i) => {
      put(
        Math.round(p.col),
        Math.round(p.row),
        i % 5 === 0 ? "@" : i % 2 === 0 ? "o" : "*",
        0.75,
        i % 4 === 0 ? "primary" : "ink",
      )
    })
  }

  return { layout, paint }
}
