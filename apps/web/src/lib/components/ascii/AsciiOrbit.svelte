<script lang="ts">
  import { onMount } from "svelte"
  import type { ClassValue } from "svelte/elements"
  import { prefersReducedMotion } from "svelte/motion"
  import {
    CELL_ASPECT,
    cssColor,
    glyphFont,
    loadGlyphFont,
  } from "$lib/ascii/glyphs"

  let { class: className }: { class?: ClassValue } = $props()

  const COLS = 56
  const ROWS = Math.round(COLS / CELL_ASPECT)
  const TRAIL = "@%#*+=-:."
  const ORBITS = [
    { radius: 0.46, period: 90_000, trail: 14, phase: 3.6, planet: true },
    { radius: 0.31, period: 34_000, trail: 5, phase: 0.8, planet: false },
    { radius: 0.18, period: 16_000, trail: 3, phase: 2.2, planet: false },
  ]

  let canvas = $state<HTMLCanvasElement>()

  onMount(() => {
    const surface = canvas
    const ctx = surface?.getContext("2d")

    if (!surface || !ctx) {
      return
    }

    const still =
      prefersReducedMotion.current ||
      document.documentElement.dataset.motion === "false"

    let colors = { ring: "", sun: "", planet: "", moon: "" }
    let width = 0
    let height = 0
    let visible = false
    let frame = 0
    let last = ""
    let disposed = false

    const cell = () => ({ w: width / COLS, h: height / ROWS })

    const glyph = (char: string, col: number, row: number, color: string) => {
      const { w, h } = cell()

      ctx.fillStyle = color
      ctx.fillText(char, (col + 0.5) * w, (row + 0.5) * h)
    }

    const spot = (radius: number, angle: number) => {
      const { w, h } = cell()
      const x = width / 2 + Math.cos(angle) * radius * width
      const y = height / 2 + Math.sin(angle) * radius * width

      return { col: Math.floor(x / w), row: Math.floor(y / h) }
    }

    const draw = (now: number) => {
      const { w, h } = cell()
      const placed = ORBITS.map(o => ({
        ...o,
        angle: o.phase + (still ? 0 : (now / o.period) * Math.PI * 2),
      }))
      const key = placed
        .map(o => spot(o.radius, o.angle))
        .map(p => `${p.col}:${p.row}`)
        .join("|")

      if (key === last) {
        return
      }

      last = key
      ctx.clearRect(0, 0, width, height)
      ctx.font = glyphFont(h * 0.78)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const dx = (col + 0.5) * w - width / 2
          const dy = (row + 0.5) * h - height / 2
          const distance = Math.hypot(dx, dy) || 1
          const d = distance / width
          const band =
            (Math.abs((dx / distance) * w) + Math.abs((dy / distance) * h)) /
            2 /
            width

          if (d < 0.05) {
            ctx.globalAlpha = 1
            glyph(d < 0.03 ? "@" : "%", col, row, colors.sun)
            continue
          }

          if (d < 0.08) {
            ctx.globalAlpha = 0.5
            glyph("+", col, row, colors.sun)
            continue
          }

          for (const orbit of ORBITS) {
            if (Math.abs(d - orbit.radius) < band) {
              ctx.globalAlpha = 0.25
              glyph(".", col, row, colors.ring)
            }
          }
        }
      }

      for (const orbit of placed) {
        const angle = orbit.angle
        const color = orbit.planet ? colors.planet : colors.moon
        const step = (w / width / orbit.radius) * 0.9

        for (let k = orbit.trail; k >= 0; k--) {
          const { col, row } = spot(orbit.radius, angle - k * step)
          const fade = 1 - k / (orbit.trail + 1)
          const char = orbit.planet
            ? (TRAIL[Math.min(TRAIL.length - 1, k)] ?? ".")
            : k === 0
              ? "*"
              : "."

          ctx.globalAlpha = orbit.planet ? fade : fade * 0.7
          glyph(char, col, row, color)
        }
      }

      ctx.globalAlpha = 1
    }

    const tick = (now: number) => {
      frame = 0
      draw(now)

      if (visible && !still) {
        frame = requestAnimationFrame(tick)
      }
    }

    const resize = () => {
      const rect = surface.getBoundingClientRect()
      const dpr = devicePixelRatio || 1

      width = rect.width
      height = rect.height
      surface.width = Math.round(width * dpr)
      surface.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      last = ""
      draw(performance.now())
    }

    const sizes = new ResizeObserver(resize)

    const sight = new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting)

      if (visible && !frame) {
        frame = requestAnimationFrame(tick)
      }
    })

    loadGlyphFont().then(() => {
      if (disposed) {
        return
      }

      colors = {
        ring: cssColor(surface, "--color-base-content"),
        sun: cssColor(surface, "--color-accent"),
        planet: cssColor(surface, "--color-primary"),
        moon: cssColor(surface, "--color-secondary"),
      }
      sizes.observe(surface)
      sight.observe(surface)
    })

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      sizes.disconnect()
      sight.disconnect()
    }
  })
</script>

<canvas
  bind:this={canvas}
  class={["block w-full", className]}
  style:aspect-ratio="{COLS} / {ROWS * CELL_ASPECT}"
  aria-hidden="true"
></canvas>
