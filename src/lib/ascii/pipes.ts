import type { Attachment } from "svelte/attachments"

const RAMP = " .:-=+*#%@"

const FPS = 24

const RADIUS = 0.12

const WALL = 0.76

const FLANGE_RADIUS = 1.3

const LIGHT = { y: -0.62, z: 0.78 }

const BEND = { from: 0.1, to: 0.26 }

const FLANGES = [0.02, 0.38, 0.64]

const MIN_BEND_REACH = 36

const LANES = [
  { near: -0.45, far: -0.82 },
  { near: -0.15, far: -0.15 },
  { near: 0.15, far: 0.15 },
  { near: 0.45, far: 0.82 },
]

type Cell = {
  x: number
  y: number
  char: string | null
  shade: number
  alpha: number
  along: number
  lane: number
}

type Probe = {
  y: number
  r: number
  unit: number
  reach: number
  column: number
  left: boolean
}

const ramp = (from: number, to: number, value: number) =>
  Math.min(1, Math.max(0, (value - from) / (to - from)))

const smooth = (from: number, to: number, value: number) => {
  const t = ramp(from, to, value)

  return t * t * (3 - 2 * t)
}

const wrap = (value: number) => value - Math.round(value)

function sample({ y, r, unit, reach, column, left }: Probe) {
  let best: { n: number; slope: number; lane: number } | null = null

  const straight = reach < MIN_BEND_REACH * column

  for (const [i, lane] of LANES.entries()) {
    const rise = straight ? 0 : lane.far - lane.near
    const center =
      unit + unit * (lane.near + rise * ramp(BEND.from, BEND.to, r))
    const bending = r > BEND.from && r < BEND.to
    const run = (BEND.to - BEND.from) * reach
    const slope = bending ? ((rise * unit) / run) * (left ? -1 : 1) : 0
    const n = (y - center) / Math.hypot(1, slope) / (RADIUS * unit)

    if (!best || Math.abs(n) < Math.abs(best.n)) {
      best = { n, slope, lane: i }
    }
  }

  if (!best) {
    return null
  }

  const size = Math.abs(best.n)
  const flanges = straight ? FLANGES.slice(0, 1) : FLANGES
  const flange = flanges.some(f => Math.abs(f - r) * reach < column)

  if (flange && size < FLANGE_RADIUS) {
    return { ...best, char: "|", shade: 1 }
  }

  if (size >= 1) {
    return null
  }

  if (size > WALL) {
    const flat = Math.abs(best.slope) < 0.2
    const char = flat ? "-" : best.slope > 0 ? "\\" : "/"

    return { ...best, char, shade: 1 }
  }

  const depth = Math.sqrt(1 - best.n ** 2)
  const diffuse = Math.max(0, best.n * LIGHT.y + depth * LIGHT.z)
  const shade = Math.min(1, 0.04 + 0.62 * diffuse + diffuse ** 30 * 0.34)

  return { ...best, char: null, shade }
}

export const asciiPipes =
  (gap: number): Attachment<HTMLCanvasElement> =>
  canvas => {
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      return
    }

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
    const ink = getComputedStyle(canvas).getPropertyValue(
      "--color-base-content",
    )

    let cells: Cell[] = []
    let font = 0

    const layout = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      const dpr = devicePixelRatio

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      font = Math.max(6, height / 44)

      const rows = Math.floor(height / font)
      const column = font * 0.62
      const cols = Math.ceil(width / column)
      const middle = width / 2
      const unit = height / 2
      const reach = Math.max(1, middle - gap / 2)

      cells = []

      for (let row = 0; row < rows; row++) {
        const y = (row + 0.5) * font

        for (let col = 0; col < cols; col++) {
          const x = (col + 0.5) * column
          const left = x < middle
          const distance = left ? middle - gap / 2 - x : x - middle - gap / 2

          if (distance < 0) {
            continue
          }

          const r = distance / reach
          const hit = sample({ y, r, unit, reach, column, left })

          if (!hit) {
            continue
          }

          cells.push({
            x,
            y,
            char: hit.char,
            shade: hit.shade,
            alpha: 0.75 * smooth(0.85, 0.12, r),
            along: left ? (1 - r) / 2 : 0.5 + r / 2,
            lane: hit.lane,
          })
        }
      }
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
      ctx.font = `700 ${font}px "Pretendard Variable", Pretendard, sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillStyle = ink

      for (const cell of cells) {
        const head = (time * 0.18 + cell.lane * 0.29) % 1
        const pulse = reduced
          ? 0
          : Math.max(0, 1 - Math.abs(wrap(cell.along - head)) / 0.05)
        const level = Math.min(0.999, cell.shade + pulse * 0.3)
        const char = cell.char ?? RAMP[Math.floor(level * RAMP.length)]

        if (char === " ") {
          continue
        }

        ctx.globalAlpha = cell.alpha * (0.55 + 0.45 * level)
        ctx.fillText(char, cell.x, cell.y)
      }

      ctx.globalAlpha = 1
    }

    let frame = 0
    let last = 0
    let visible = true

    const loop = (now: number) => {
      frame = requestAnimationFrame(loop)

      if (now - last < 1000 / FPS) {
        return
      }

      last = now
      draw(now / 1000)
    }

    const run = () => {
      cancelAnimationFrame(frame)

      if (visible && !reduced) {
        frame = requestAnimationFrame(loop)
      }
    }

    const refresh = () => {
      layout()
      draw(performance.now() / 1000)
    }

    const resize = new ResizeObserver(refresh)
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      run()
    })

    resize.observe(canvas)
    seen.observe(canvas)
    document.fonts.load(`700 1rem "Pretendard Variable"`, RAMP).then(refresh)

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      seen.disconnect()
    }
  }
