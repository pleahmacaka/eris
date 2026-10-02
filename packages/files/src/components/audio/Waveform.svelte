<script lang="ts">
  const BAR = 3
  const GAP = 2
  const FLOOR = 0.08

  let {
    peaks,
    progress,
    label,
    onseek,
  }: {
    peaks: number[] | null
    progress: number
    label: string
    onseek: (fraction: number) => void
  } = $props()

  let canvas = $state<HTMLCanvasElement>()
  let width = $state(0)
  let height = $state(0)
  let theme = $state(0)

  const bars = $derived.by(() => {
    const count = Math.max(1, Math.floor((width + GAP) / (BAR + GAP)))

    if (!peaks?.length) {
      return new Array<number>(count).fill(FLOOR)
    }

    return Array.from({ length: count }, (_, index) => {
      const from = Math.floor((index * peaks.length) / count)
      const to = Math.max(from + 1, Math.floor(((index + 1) * peaks.length) / count))
      let top = 0

      for (let at = from; at < to; at++) {
        top = Math.max(top, peaks[at])
      }

      return Math.max(FLOOR, top / 255)
    })
  })

  $effect(() => {
    const observer = new MutationObserver(() => theme++)

    observer.observe(document.documentElement, { attributes: true })

    return () => observer.disconnect()
  })

  $effect(() => {
    if (canvas) {
      canvas.width = Math.round(width * window.devicePixelRatio)
      canvas.height = Math.round(height * window.devicePixelRatio)
    }
  })

  $effect(() => {
    void theme

    const context = canvas?.getContext("2d")

    if (!canvas || !context || !width || !height) {
      return
    }

    const ratio = canvas.width / width
    const style = getComputedStyle(canvas)
    const played = style.getPropertyValue("--color-primary")
    const rest = style.getPropertyValue("--color-base-content")
    const reached = progress * bars.length

    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    context.clearRect(0, 0, width, height)

    bars.forEach((level, index) => {
      const size = Math.max(2, level * height)
      const done = index < reached

      context.globalAlpha = done ? 1 : 0.28
      context.fillStyle = done ? played : rest
      context.beginPath()
      context.roundRect(index * (BAR + GAP), (height - size) / 2, BAR, size, BAR / 2)
      context.fill()
    })
  })

  const seek = (e: PointerEvent) => {
    if (e.buttons !== 1 || !width) {
      return
    }

    onseek(Math.min(1, Math.max(0, e.offsetX / width)))
  }
</script>

<div
  class="relative h-10 min-w-0 flex-1"
  bind:clientWidth={width}
  bind:clientHeight={height}
>
  <canvas
    bind:this={canvas}
    class="absolute inset-0 size-full cursor-pointer touch-none"
    role="slider"
    tabindex="-1"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(progress * 100)}
    onpointerdown={e => {
      e.currentTarget.setPointerCapture(e.pointerId)
      seek(e)
    }}
    onpointermove={seek}
  ></canvas>
</div>
