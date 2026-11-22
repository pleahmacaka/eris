import type { Attachment } from "svelte/attachments"

type Point = { x: number; y: number }

type Wave = Point & { radius: number }

const RAMP = ".:-=+*#%@"

const HOVER_RADIUS = 64
const HOVER_PUSH = 14
const WAVE_SPEED = 7
const WAVE_WIDTH = 24
const WAVE_PUSH = 8
const EASE = 0.2
const REST = 0.05
const SCRAMBLE_HEAT = 0.3
const SCRAMBLE_RATE = 0.2

const pick = (heat: number) => {
  const reach = Math.ceil(heat * RAMP.length)
  return RAMP[RAMP.length - 1 - Math.floor(Math.random() * reach)] ?? "@"
}

export const asciiField: Attachment<SVGSVGElement> = svg => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return
  }

  const nodes = [...svg.querySelectorAll<SVGTextElement>("text[data-glyph]")]
  const origins = nodes.map(node => ({
    x: Number(node.getAttribute("x")),
    y: Number(node.getAttribute("y")),
    glyph: node.dataset.glyph ?? "",
  }))
  const offsetX = new Float32Array(nodes.length)
  const offsetY = new Float32Array(nodes.length)
  const scrambled = new Uint8Array(nodes.length)
  const box = svg.viewBox.baseVal
  const reach = Math.hypot(box.width, box.height)

  let pointer: Point | null = null
  let waves: Wave[] = []
  let frame = 0

  const toLocal = (event: PointerEvent): Point | null => {
    const matrix = svg.getScreenCTM()

    if (!matrix) {
      return null
    }

    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    )

    return { x: point.x, y: point.y }
  }

  const isNear = (point: Point) =>
    point.x > -HOVER_RADIUS &&
    point.y > -HOVER_RADIUS &&
    point.x < box.width + HOVER_RADIUS &&
    point.y < box.height + HOVER_RADIUS

  const step = () => {
    frame = 0
    waves = waves
      .map(wave => ({ ...wave, radius: wave.radius + WAVE_SPEED }))
      .filter(wave => wave.radius < reach + WAVE_WIDTH)

    let moving = pointer !== null || waves.length > 0

    origins.forEach((origin, index) => {
      let targetX = 0
      let targetY = 0
      let heat = 0

      if (pointer) {
        const dx = origin.x - pointer.x
        const dy = origin.y - pointer.y
        const distance = Math.hypot(dx, dy)

        if (distance > 0 && distance < HOVER_RADIUS) {
          const force = (1 - distance / HOVER_RADIUS) ** 2
          targetX += (dx / distance) * HOVER_PUSH * force
          targetY += (dy / distance) * HOVER_PUSH * force
          heat = Math.max(heat, force)
        }
      }

      for (const wave of waves) {
        const dx = origin.x - wave.x
        const dy = origin.y - wave.y
        const distance = Math.hypot(dx, dy)
        const band = 1 - Math.abs(distance - wave.radius) / WAVE_WIDTH

        if (distance > 0 && band > 0) {
          targetX += (dx / distance) * WAVE_PUSH * band
          targetY += (dy / distance) * WAVE_PUSH * band
          heat = Math.max(heat, band)
        }
      }

      offsetX[index] += (targetX - offsetX[index]) * EASE
      offsetY[index] += (targetY - offsetY[index]) * EASE

      const settled =
        Math.abs(offsetX[index]) < REST && Math.abs(offsetY[index]) < REST

      if (settled) {
        offsetX[index] = 0
        offsetY[index] = 0
      } else {
        moving = true
      }

      const node = nodes[index]

      node.setAttribute(
        "transform",
        settled
          ? ""
          : `translate(${offsetX[index].toFixed(2)} ${offsetY[index].toFixed(2)})`,
      )

      if (heat > SCRAMBLE_HEAT) {
        if (Math.random() < SCRAMBLE_RATE) {
          node.textContent = pick(heat)
          scrambled[index] = 1
        }
      } else if (scrambled[index]) {
        node.textContent = origin.glyph
        scrambled[index] = 0
      }
    })

    if (moving) {
      frame = requestAnimationFrame(step)
    }
  }

  const wake = () => {
    if (!frame) {
      frame = requestAnimationFrame(step)
    }
  }

  const onMove = (event: PointerEvent) => {
    const point = toLocal(event)
    const next = point && isNear(point) ? point : null

    if (next || pointer) {
      pointer = next
      wake()
    }
  }

  const onLeave = () => {
    pointer = null
    wake()
  }

  const onDown = (event: PointerEvent) => {
    const point = toLocal(event)

    if (point) {
      waves.push({ ...point, radius: 0 })
      wake()
    }
  }

  window.addEventListener("pointermove", onMove, { passive: true })
  document.documentElement.addEventListener("pointerleave", onLeave)
  svg.addEventListener("pointerdown", onDown)

  return () => {
    cancelAnimationFrame(frame)
    window.removeEventListener("pointermove", onMove)
    document.documentElement.removeEventListener("pointerleave", onLeave)
    svg.removeEventListener("pointerdown", onDown)
  }
}
