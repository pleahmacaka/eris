<script lang="ts">
  let { src, alt }: { src: string; alt: string } = $props()

  const MAX_PERCENT = 800

  const WHEEL_RATE = 0.0015

  let frame = $state<HTMLDivElement>()

  let image = $state<HTMLImageElement>()

  let scale = $state(1)

  let x = $state(0)

  let y = $state(0)

  let dragging = $state(false)

  const natural = () =>
    image && image.clientWidth ? image.naturalWidth / image.clientWidth : 1

  const percent = $derived(Math.round((scale / natural()) * 100))

  const pannable = $derived(scale > 1)

  const clamp = (offset: number, size: number, bounds: number) => {
    const room = Math.max(0, (size * scale - bounds) / 2)

    return Math.min(room, Math.max(-room, offset))
  }

  const settle = () => {
    if (!image || !frame) {
      return
    }

    x = clamp(x, image.clientWidth, frame.clientWidth)
    y = clamp(y, image.clientHeight, frame.clientHeight)
  }

  const zoom = (e: WheelEvent) => {
    if (!e.ctrlKey || !frame) {
      return
    }

    e.preventDefault()

    const box = frame.getBoundingClientRect()
    const dx = e.clientX - box.left - box.width / 2
    const dy = e.clientY - box.top - box.height / 2
    const limit = Math.max(1, (MAX_PERCENT / 100) * natural())
    const wanted = scale * Math.exp(-e.deltaY * WHEEL_RATE)
    const next = Math.min(limit, Math.max(1, wanted))
    const ratio = next / scale

    x = dx - ratio * (dx - x)
    y = dy - ratio * (dy - y)
    scale = next
    settle()
  }

  const pan = (e: PointerEvent) => {
    if (!pannable || e.button !== 0) {
      return
    }

    const target = e.currentTarget as HTMLElement
    const start = { x: e.clientX - x, y: e.clientY - y }

    const move = (next: PointerEvent) => {
      x = next.clientX - start.x
      y = next.clientY - start.y
      settle()
    }

    const stop = () => {
      dragging = false
      target.removeEventListener("pointermove", move)
      target.removeEventListener("pointerup", stop)
      target.removeEventListener("pointercancel", stop)
    }

    target.setPointerCapture(e.pointerId)
    dragging = true
    target.addEventListener("pointermove", move)
    target.addEventListener("pointerup", stop)
    target.addEventListener("pointercancel", stop)
  }

  const reset = () => {
    scale = 1
    x = 0
    y = 0
  }
</script>

<div
  bind:this={frame}
  role="img"
  aria-label={alt}
  class={[
    "relative flex size-full items-center justify-center overflow-hidden",
    pannable && (dragging ? "cursor-grabbing" : "cursor-grab"),
  ]}
  onwheel={zoom}
  onpointerdown={pan}
  ondblclick={reset}
>
  <img
    bind:this={image}
    {src}
    {alt}
    draggable="false"
    class="max-h-full max-w-full object-contain select-none"
    style:transform="translate({x}px, {y}px) scale({scale})"
  />

  {#if scale !== 1}
    <span
      class="pointer-events-none absolute right-2 bottom-2 rounded-field bg-base-100/80 px-1.5 py-0.5 text-xs tabular-nums"
    >
      {percent}%
    </span>
  {/if}
</div>
