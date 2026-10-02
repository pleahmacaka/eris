<script lang="ts">
  import { onMount } from "svelte"
  import type { ClassValue } from "svelte/elements"
  import { prefersReducedMotion } from "svelte/motion"
  import {
    CELL_ASPECT,
    cssColor,
    glyphFont,
    loadGlyphFont,
    RAMP,
    randomGlyph,
  } from "$lib/ascii/glyphs"
  import { type Cell, type Painter, rasterize } from "$lib/ascii/raster"

  type Props = {
    paint: Painter
    cols: number
    rows: number
    tint?: string
    interactive?: boolean
    class?: ClassValue
  }

  let {
    paint,
    cols,
    rows,
    tint,
    interactive = false,
    class: className,
  }: Props = $props()

  type Particle = Cell & {
    dx: number
    dy: number
    vx: number
    vy: number
    glitch: number
  }

  const REVEAL_MS = 1100
  const REACH = 6
  const PUSH = 2.8
  const RIPPLE_SPEED = 0.05
  const RIPPLE_LIFE = 900
  const RIPPLE_BAND = 2.5

  let host = $state<HTMLDivElement>()
  let canvas = $state<HTMLCanvasElement>()

  onMount(() => {
    const surface = canvas
    const area = host
    const ctx = surface?.getContext("2d")

    if (!surface || !area || !ctx) {
      return
    }

    const still =
      prefersReducedMotion.current ||
      document.documentElement.dataset.motion === "false"
    const ripples: { x: number; y: number; t: number }[] = []

    let particles: Particle[] = []
    let colors = { noise: "", flash: "", tint: "" }
    let width = 0
    let height = 0
    let revealStart = -1
    let visible = false
    let pointer: { x: number; y: number } | null = null
    let frame = 0
    let disposed = false

    const forces = (x: number, y: number, now: number, cell: number) => {
      let heat = 0
      let fx = 0
      let fy = 0

      if (pointer) {
        const dx = x - pointer.x
        const dy = y - pointer.y
        const distance = Math.hypot(dx, dy) || 1
        const reach = distance / cell

        if (reach < REACH) {
          heat = (1 - reach / REACH) ** 2
          fx += (dx / distance) * heat * PUSH * cell
          fy += (dy / distance) * heat * PUSH * cell
        }
      }

      for (const ripple of ripples) {
        const age = now - ripple.t
        const dx = x - ripple.x
        const dy = y - ripple.y
        const distance = Math.hypot(dx, dy) || 1
        const gap = Math.abs(distance - age * RIPPLE_SPEED * cell) / cell

        if (gap < RIPPLE_BAND) {
          const kick = (1 - gap / RIPPLE_BAND) * (1 - age / RIPPLE_LIFE)

          fx += (dx / distance) * kick * PUSH * cell
          fy += (dy / distance) * kick * PUSH * cell
          heat = Math.max(heat, kick)
        }
      }

      return { heat, fx, fy }
    }

    const draw = (now: number) => {
      const cellWidth = width / cols
      const cellHeight = height / rows
      const progress = still ? 2 : (now - revealStart) / REVEAL_MS

      let busy = !still && progress < 1.2

      while (ripples[0] && now - ripples[0].t > RIPPLE_LIFE) {
        ripples.shift()
      }

      ctx.clearRect(0, 0, width, height)
      ctx.font = glyphFont(cellHeight * 0.78)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      for (const p of particles) {
        if (progress < p.at - 0.18) {
          continue
        }

        const x = (p.col + 0.5) * cellWidth
        const y = (p.row + 0.5) * cellHeight
        const { heat, fx, fy } = forces(x, y, now, cellWidth)

        p.vx = (p.vx + (fx - p.dx) * 0.2) * 0.7
        p.vy = (p.vy + (fy - p.dy) * 0.2) * 0.7
        p.dx += p.vx
        p.dy += p.vy

        if (heat > 0.2 && Math.random() < heat * 0.12) {
          p.glitch = now + 90
        }

        const settling =
          Math.abs(p.dx) + Math.abs(p.dy) + Math.abs(p.vx) + Math.abs(p.vy)
        const glitching = p.glitch > now
        const scrambled = progress < p.at || glitching

        if (settling > 0.05 || glitching) {
          busy = true
        }

        const level = Math.min(RAMP.length - 1, p.level + Math.round(heat * 3))

        ctx.globalAlpha = scrambled ? 0.6 : 1
        ctx.fillStyle = scrambled
          ? colors.noise
          : heat > 0.45
            ? colors.flash
            : colors.tint || p.color
        ctx.fillText(
          scrambled ? randomGlyph() : (RAMP[level] ?? "#"),
          x + p.dx,
          y + p.dy,
        )
      }

      ctx.globalAlpha = 1

      return busy || pointer !== null || ripples.length > 0
    }

    const tick = (now: number) => {
      frame = 0

      if (draw(now)) {
        schedule()
      }
    }

    const schedule = () => {
      if (!frame && !disposed && revealStart >= 0) {
        frame = requestAnimationFrame(tick)
      }
    }

    const start = () => {
      if (revealStart < 0 && visible && particles.length > 0) {
        revealStart = performance.now()
        schedule()
      }
    }

    const resize = () => {
      const rect = area.getBoundingClientRect()
      const dpr = devicePixelRatio || 1

      width = rect.width
      height = rect.height
      surface.width = Math.round(width * dpr)
      surface.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      schedule()
    }

    const local = (e: PointerEvent) => {
      const rect = surface.getBoundingClientRect()

      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const sizes = new ResizeObserver(resize)

    const sight = new IntersectionObserver(
      entries => {
        visible = entries.some(e => e.isIntersecting)
        start()
      },
      { threshold: 0.2 },
    )

    if (interactive && !still) {
      area.addEventListener("pointermove", e => {
        pointer = local(e)
        schedule()
      })

      area.addEventListener("pointerleave", () => {
        pointer = null
      })

      area.addEventListener("pointerdown", e => {
        ripples.push({ ...local(e), t: performance.now() })
        schedule()
      })
    }

    sizes.observe(area)
    sight.observe(area)

    Promise.all([loadGlyphFont(), rasterize(paint, cols, rows)]).then(
      ([, result]) => {
        if (disposed) {
          return
        }

        particles = result.map(cell => ({
          ...cell,
          dx: 0,
          dy: 0,
          vx: 0,
          vy: 0,
          glitch: 0,
        }))
        colors = {
          noise: cssColor(surface, "--color-primary"),
          flash: cssColor(surface, "--color-base-content"),
          tint: tint ? cssColor(surface, tint) : "",
        }
        start()
      },
    )

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      sizes.disconnect()
      sight.disconnect()
    }
  })
</script>

<div
  bind:this={host}
  class={["relative", className]}
  style:aspect-ratio="{cols} / {rows * CELL_ASPECT}"
  aria-hidden="true"
>
  <canvas bind:this={canvas} class="absolute inset-0 size-full"></canvas>
</div>
