import type { Attachment } from "svelte/attachments"

import { calm, rem } from "./motion"

export const RAMP = " .:-=+*#%@"

export type Tone = "ink" | "primary" | "accent"

export type Grid = {
  cols: number
  rows: number
  width: number
  height: number
  cellWidth: number
  cellHeight: number
}

export type Put = (
  col: number,
  row: number,
  char: string,
  alpha: number,
  tone?: Tone,
) => void

export type Scene = {
  layout?: (grid: Grid) => void
  paint: (put: Put, grid: Grid, time: number) => void
}

export type FieldOptions = {
  cell?: number
  rows?: number
  aspect?: number
  weight?: number
  fps?: number
  still?: number
}

const FONT = '"Pretendard Variable", Pretendard, sans-serif'

export const shade = (level: number) =>
  RAMP[Math.max(0, Math.min(RAMP.length - 1, Math.floor(level * RAMP.length)))]

export function field(
  scene: Scene,
  options: FieldOptions = {},
): Attachment<HTMLCanvasElement> {
  const {
    cell = 0.75,
    rows,
    aspect = 0.62,
    weight = 600,
    fps = 24,
    still = 1e9,
  } = options

  return canvas => {
    const context = canvas.getContext("2d")

    if (!context) {
      return
    }

    const reduced = matchMedia("(prefers-reduced-motion: reduce)")
    const tones: Record<Tone, string> = { ink: "", primary: "", accent: "" }

    const grid: Grid = {
      cols: 0,
      rows: 0,
      width: 0,
      height: 0,
      cellWidth: 0,
      cellHeight: 0,
    }

    let frame = 0
    let last = 0
    let visible = false
    let size = cell

    const resting = () => reduced.matches || calm()

    const paintTones = () => {
      const style = getComputedStyle(canvas)

      tones.ink = style.getPropertyValue("--color-base-content").trim()
      tones.primary = style.getPropertyValue("--color-primary").trim()
      tones.accent = style.getPropertyValue("--color-accent").trim()
    }

    const measure = () => {
      const ratio = Math.min(2, devicePixelRatio || 1)

      grid.width = canvas.clientWidth
      grid.height = canvas.clientHeight
      grid.cellHeight = rows
        ? Math.max(rem(0.25), grid.height / rows)
        : rem(cell)
      size = grid.cellHeight / rem(1)
      grid.cellWidth = grid.cellHeight * aspect
      grid.cols = Math.floor(grid.width / grid.cellWidth)
      grid.rows = Math.floor(grid.height / grid.cellHeight)

      canvas.width = Math.round(grid.width * ratio)
      canvas.height = Math.round(grid.height * ratio)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)

      scene.layout?.(grid)
    }

    const draw = (time: number) => {
      let tone: Tone | null = null

      context.clearRect(0, 0, grid.width, grid.height)
      context.font = `${weight} ${size}rem ${FONT}`
      context.textAlign = "center"
      context.textBaseline = "middle"

      const put: Put = (col, row, char, alpha, next = "ink") => {
        if (char === " " || alpha <= 0) {
          return
        }

        if (next !== tone) {
          tone = next
          context.fillStyle = tones[next]
        }

        context.globalAlpha = Math.min(1, alpha)
        context.fillText(
          char,
          (col + 0.5) * grid.cellWidth,
          (row + 0.5) * grid.cellHeight,
        )
      }

      scene.paint(put, grid, time)
      context.globalAlpha = 1
    }

    let moving = !resting()

    const now = () => (moving ? performance.now() / 1000 : still)

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop)

      if (time - last < 1000 / fps) {
        return
      }

      last = time
      draw(time / 1000)
    }

    const run = () => {
      cancelAnimationFrame(frame)

      moving =
        visible &&
        !resting() &&
        document.visibilityState === "visible" &&
        document.hasFocus()

      if (moving) {
        frame = requestAnimationFrame(loop)
      } else {
        draw(still)
      }
    }

    const refresh = () => {
      measure()
      draw(now())
    }

    const change = () => {
      paintTones()
      draw(now())
      run()
    }

    const resize = new ResizeObserver(refresh)

    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      run()
    })

    const themed = new MutationObserver(change)

    paintTones()
    resize.observe(canvas)
    seen.observe(canvas)
    themed.observe(document.documentElement, {
      attributeFilter: ["data-theme", "data-motion", "class"],
    })
    reduced.addEventListener("change", change)
    document.addEventListener("visibilitychange", run)
    window.addEventListener("focus", run)
    window.addEventListener("blur", run)
    document.fonts.load(`${weight} ${cell}rem ${FONT}`, RAMP).then(refresh)

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      seen.disconnect()
      themed.disconnect()
      reduced.removeEventListener("change", change)
      document.removeEventListener("visibilitychange", run)
      window.removeEventListener("focus", run)
      window.removeEventListener("blur", run)
    }
  }
}
