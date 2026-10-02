<script lang="ts">
  import { onMount } from "svelte"
  import type { ClassValue } from "svelte/elements"
  import { prefersReducedMotion } from "svelte/motion"
  import { cssColor, glyphFont, loadGlyphFont, RAMP } from "$lib/ascii/glyphs"

  let { class: className }: { class?: ClassValue } = $props()

  const CELL_REM = 1.25
  const ROW_RATIO = 1.4
  const REACH = 6
  const DECAY = 0.93
  const SPARK_EVERY = 120
  const IDLE_FRAME_MS = 100
  const POINTER_IDLE_MS = 1000

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
    const base = document.createElement("canvas")

    let colors = { dot: "", glow: "", hot: "" }
    let cellWidth = 0
    let cellHeight = 0
    let cols = 0
    let rows = 0
    let width = 0
    let height = 0
    let energy = new Float32Array(0)
    let visible = false
    let lastSpark = 0
    let lastFrame = 0
    let lastPointer = Number.NEGATIVE_INFINITY
    let frame = 0
    let idle = 0
    let disposed = false

    const paintBase = () => {
      const dpr = devicePixelRatio || 1
      const layer = base.getContext("2d")

      base.width = surface.width
      base.height = surface.height

      if (!layer) {
        return
      }

      const cx = width / 2
      const cy = height / 2
      const glow = layer.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        Math.max(width, height) / 2,
      )

      layer.setTransform(dpr, 0, 0, dpr, 0, 0)
      glow.addColorStop(0, colors.glow)
      glow.addColorStop(1, "transparent")
      layer.globalAlpha = 0.09
      layer.fillStyle = glow
      layer.fillRect(0, 0, width, height)

      layer.font = glyphFont(cellHeight * 0.6)
      layer.textAlign = "center"
      layer.textBaseline = "middle"
      layer.fillStyle = colors.dot

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = (col + 0.5) * cellWidth
          const y = (row + 0.5) * cellHeight
          const d = Math.hypot((x - cx) / cx, ((y - cy) / cy) * 0.8)

          layer.globalAlpha = 0.05 + 0.2 * Math.exp(-d * d * 2.2)
          layer.fillText(".", x, y)
        }
      }
    }

    const layout = () => {
      const rect = surface.getBoundingClientRect()
      const dpr = devicePixelRatio || 1
      const rem = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      )

      width = rect.width
      height = rect.height
      cellWidth = rem * CELL_REM
      cellHeight = cellWidth * ROW_RATIO
      cols = Math.ceil(width / cellWidth)
      rows = Math.ceil(height / cellHeight)
      energy = new Float32Array(cols * rows)
      surface.width = Math.round(width * dpr)
      surface.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paintBase()
      draw()
    }

    const heat = (x: number, y: number, strength: number) => {
      const col = Math.floor(x / cellWidth)
      const row = Math.floor(y / cellHeight)

      for (let r = row - REACH; r <= row + REACH; r++) {
        for (let c = col - REACH; c <= col + REACH; c++) {
          if (r < 0 || c < 0 || r >= rows || c >= cols) {
            continue
          }

          const d = Math.hypot(c - col, (r - row) * ROW_RATIO) / REACH

          if (d < 1) {
            const i = r * cols + c

            energy[i] = Math.max(energy[i], (1 - d) ** 1.5 * strength)
          }
        }
      }
    }

    const draw = (decay = 1) => {
      ctx.clearRect(0, 0, width, height)
      ctx.drawImage(base, 0, 0, width, height)
      ctx.font = glyphFont(cellHeight * 0.62)
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      for (let i = 0; i < energy.length; i++) {
        const e = energy[i]

        if (e < 0.03) {
          continue
        }

        energy[i] = e * decay
        ctx.globalAlpha = Math.min(1, e * 0.9)
        ctx.fillStyle = e > 0.6 ? colors.hot : colors.glow
        ctx.fillText(
          RAMP[Math.ceil(e * (RAMP.length - 1))] ?? "@",
          ((i % cols) + 0.5) * cellWidth,
          (Math.floor(i / cols) + 0.5) * cellHeight,
        )
      }

      ctx.globalAlpha = 1
    }

    const tick = (now: number) => {
      frame = 0

      const elapsed = lastFrame ? now - lastFrame : 16

      lastFrame = now

      if (now - lastSpark > SPARK_EVERY) {
        lastSpark = now
        energy[Math.floor(Math.random() * energy.length)] =
          0.4 + Math.random() * 0.5
      }

      draw(DECAY ** (elapsed / 16))

      if (!visible) {
        return
      }

      if (now - lastPointer < POINTER_IDLE_MS) {
        schedule()
      } else {
        clearTimeout(idle)
        idle = window.setTimeout(schedule, IDLE_FRAME_MS)
      }
    }

    const schedule = () => {
      if (!frame && !disposed && !still) {
        frame = requestAnimationFrame(tick)
      }
    }

    const onPointer = (e: PointerEvent) => {
      if (!visible) {
        return
      }

      const rect = surface.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      if (x >= 0 && y >= 0 && x <= width && y <= height) {
        lastPointer = performance.now()
        heat(x, y, 0.9)
        schedule()
      }
    }

    const sizes = new ResizeObserver(layout)

    const sight = new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting)
      schedule()
    })

    loadGlyphFont().then(() => {
      if (disposed) {
        return
      }

      colors = {
        dot: cssColor(surface, "--color-base-content"),
        glow: cssColor(surface, "--color-primary"),
        hot: cssColor(surface, "--color-secondary"),
      }
      sizes.observe(surface)
      sight.observe(surface)

      if (!still) {
        window.addEventListener("pointermove", onPointer, { passive: true })
      }
    })

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      clearTimeout(idle)
      sizes.disconnect()
      sight.disconnect()
      window.removeEventListener("pointermove", onPointer)
    }
  })
</script>

<canvas
  bind:this={canvas}
  class={["pointer-events-none", className]}
  aria-hidden="true"
></canvas>
