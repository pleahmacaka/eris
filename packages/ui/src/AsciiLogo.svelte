<script lang="ts">
  import { LOGO_VIEWBOX, logoParts } from "./logo"

  let { cols = 40, class: className = "" }: { cols?: number; class?: string } = $props()

  const RAMP = " .:-=+*#%@"
  const CELL_ASPECT = 1.9
  const SAMPLES = 4
  const REVEAL_MS = 700

  type Cell = { col: number; row: number; char: string; part: number; delay: number }

  let canvas = $state<HTMLCanvasElement>()
  let width = $state(0)
  let theme = $state(0)

  const rows = $derived(Math.round(cols / CELL_ASPECT))

  const cellWidth = $derived(width / cols)

  const height = $derived(cellWidth * CELL_ASPECT * rows)

  const sample = (columns: number, lines: number): Cell[] => {
    const probe = document.createElement("canvas").getContext("2d")

    if (!probe) {
      return []
    }

    const paths = logoParts.map(p => new Path2D(p.d))
    const cells: Cell[] = []

    for (let row = 0; row < lines; row++) {
      for (let col = 0; col < columns; col++) {
        const hits = paths.map(() => 0)

        for (let i = 0; i < SAMPLES; i++) {
          for (let j = 0; j < SAMPLES; j++) {
            const x = ((col + (i + 0.5) / SAMPLES) / columns) * LOGO_VIEWBOX
            const y = ((row + (j + 0.5) / SAMPLES) / lines) * LOGO_VIEWBOX

            paths.forEach((path, k) => {
              if (probe.isPointInPath(path, x, y)) {
                hits[k]++
              }
            })
          }
        }

        const total = hits.reduce((sum, n) => sum + n, 0)

        if (total === 0) {
          continue
        }

        const level = Math.ceil((total / (SAMPLES * SAMPLES)) * (RAMP.length - 1))

        cells.push({
          col,
          row,
          char: RAMP[Math.max(1, level)],
          part: hits.indexOf(Math.max(...hits)),
          delay: ((col * 7919 + row * 104729) % 97) / 97,
        })
      }
    }

    return cells
  }

  const cells = $derived(sample(cols, rows))

  $effect(() => {
    const observer = new MutationObserver(() => theme++)

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-mode", "data-motion"],
    })

    return () => observer.disconnect()
  })

  $effect(() => {
    void theme

    const context = canvas?.getContext("2d")

    if (!canvas || !context || width === 0) {
      return
    }

    const root = document.documentElement
    const dpr = window.devicePixelRatio || 1
    const cellHeight = cellWidth * CELL_ASPECT
    const light = root.dataset.mode === "light"
    const colors = logoParts.map(p => (light ? p.lightColor : p.color))
    const family = getComputedStyle(canvas).fontFamily

    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    const paint = (progress: number) => {
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.clearRect(0, 0, width, height)
      context.font = `600 ${cellHeight * 0.78}px ${family}`
      context.textAlign = "center"
      context.textBaseline = "middle"

      for (const cell of cells) {
        if (cell.delay > progress) {
          continue
        }

        context.fillStyle = colors[cell.part]
        context.fillText(cell.char, (cell.col + 0.5) * cellWidth, (cell.row + 0.5) * cellHeight)
      }
    }

    if (root.dataset.motion === "false") {
      paint(1)

      return
    }

    const start = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / REVEAL_MS)

      paint(progress)

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  })
</script>

<div bind:clientWidth={width} class={className} role="img" aria-label="Eris">
  <canvas bind:this={canvas} class="block w-full" style:height="{height}px"></canvas>
</div>
