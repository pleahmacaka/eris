import { CELL_ASPECT, FONT_FAMILY, RAMP } from "./glyphs"

export type Cell = {
  col: number
  row: number
  level: number
  color: string
  at: number
}

export type Painter = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void | Promise<void>

const SUPERSAMPLE = 4
const MIN_COVERAGE = 0.05

export const svgPainter =
  (markup: string, stroke = 0): Painter =>
  (ctx, width, height) => {
    const doc = new DOMParser().parseFromString(markup, "image/svg+xml")
    const [, , boxWidth = 24, boxHeight = 24] = (
      doc.documentElement.getAttribute("viewBox") ?? ""
    )
      .split(" ")
      .map(Number)
    const scale = Math.min(width / boxWidth, height / boxHeight)

    ctx.translate(
      (width - boxWidth * scale) / 2,
      (height - boxHeight * scale) / 2,
    )
    ctx.scale(scale, scale)
    ctx.lineWidth = stroke
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    for (const node of doc.querySelectorAll("path")) {
      const path = new Path2D(node.getAttribute("d") ?? "")
      const color = node.getAttribute("fill") ?? "#ffffff"

      ctx.fillStyle = color
      ctx.strokeStyle = color
      ctx.fill(path)

      if (stroke > 0) {
        ctx.stroke(path)
      }
    }
  }

export const textPainter =
  (text: string, weight = 900): Painter =>
  async (ctx, width, height) => {
    const font = (size: number) => `${weight} ${size}px ${FONT_FAMILY}`

    await document.fonts.load(font(64), text).catch(() => [])

    ctx.font = font(100)

    const probe = ctx.measureText(text)
    const probeWidth =
      probe.actualBoundingBoxLeft + probe.actualBoundingBoxRight
    const probeHeight =
      probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent
    const size =
      100 * Math.min((width * 0.98) / probeWidth, (height * 0.92) / probeHeight)

    ctx.font = font(size)

    const metrics = ctx.measureText(text)
    const textWidth =
      metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight
    const textHeight =
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent

    ctx.fillStyle = "#ffffff"
    ctx.fillText(
      text,
      (width - textWidth) / 2 + metrics.actualBoundingBoxLeft,
      (height - textHeight) / 2 + metrics.actualBoundingBoxAscent,
    )
  }

export const rasterize = async (
  paint: Painter,
  cols: number,
  rows: number,
): Promise<Cell[]> => {
  const canvas = document.createElement("canvas")

  canvas.width = cols * SUPERSAMPLE
  canvas.height = rows * SUPERSAMPLE

  const ctx = canvas.getContext("2d", { willReadFrequently: true })

  if (!ctx) {
    return []
  }

  ctx.scale(SUPERSAMPLE, SUPERSAMPLE / CELL_ASPECT)
  await paint(ctx, cols, rows * CELL_ASPECT)

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const cells: Cell[] = []
  const full = SUPERSAMPLE * SUPERSAMPLE * 255

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let alpha = 0
      let red = 0
      let green = 0
      let blue = 0

      for (let y = 0; y < SUPERSAMPLE; y++) {
        const line = (row * SUPERSAMPLE + y) * canvas.width

        for (let x = 0; x < SUPERSAMPLE; x++) {
          const i = (line + col * SUPERSAMPLE + x) * 4
          const a = data[i + 3]

          alpha += a
          red += data[i] * a
          green += data[i + 1] * a
          blue += data[i + 2] * a
        }
      }

      const coverage = alpha / full

      if (coverage < MIN_COVERAGE) {
        continue
      }

      cells.push({
        col,
        row,
        level: Math.max(1, Math.round(coverage * (RAMP.length - 1))),
        color: `rgb(${red / alpha} ${green / alpha} ${blue / alpha})`,
        at: ((rows - row) / rows) * 0.55 + Math.random() * 0.3,
      })
    }
  }

  return cells
}
