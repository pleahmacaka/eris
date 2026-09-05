<script lang="ts">
  import { emit, listen } from "@tauri-apps/api/event"
  import * as native from "$lib/native"

  type Slot = {
    hwnd: number
    x: number
    y: number
    width: number
    height: number
  }

  let slots = $state<Slot[]>([])
  let hovered = $state<number | null>(null)

  $effect(() => {
    document.documentElement.dataset.surface = "overlay"

    const stops = [
      listen<Slot[]>("preview-shown", e => {
        slots = e.payload
      }),
      listen("preview-hidden", () => {
        slots = []
        hovered = null
      }),
    ]

    return () => {
      for (const stop of stops) {
        stop.then(off => off()).catch(() => undefined)
      }
    }
  })

  const setHover = (over: boolean) => {
    emit("preview-hover", over).catch(() => undefined)
  }

  const pick = (slot: Slot) => {
    setHover(false)
    native.activateWindow(slot.hwnd).catch(() => undefined)
    native.previewHide().catch(() => undefined)
  }
</script>

<div
  role="presentation"
  class="relative h-full w-full rounded-lg border border-base-content/10 bg-base-100/70 shadow-2xl backdrop-blur-2xl"
  onmouseenter={() => setHover(true)}
  onmouseleave={() => setHover(false)}
>
  {#each slots as slot (slot.hwnd)}
    <button
      type="button"
      class="absolute transition-shadow duration-150"
      class:selected={hovered === slot.hwnd}
      style:left="{slot.x}px"
      style:top="{slot.y}px"
      style:width="{slot.width}px"
      style:height="{slot.height}px"
      aria-label="Switch to window"
      onmouseenter={() => (hovered = slot.hwnd)}
      onmouseleave={() => (hovered = null)}
      onclick={() => pick(slot)}
    ></button>
  {/each}
</div>

<style>
  button {
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--color-base-content) 12%, transparent);
  }

  button.selected {
    box-shadow:
      0 0 0 2px var(--color-primary),
      0 0 0 5px color-mix(in oklch, var(--color-primary) 25%, transparent);
  }
</style>
