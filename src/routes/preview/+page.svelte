<script lang="ts">
  import Icon from "@iconify/svelte"
  import { emit, listen } from "@tauri-apps/api/event"
  import { t } from "svelte-i18n"
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

  const close = (slot: Slot) => {
    native.closeWindow(slot.hwnd).catch(() => undefined)
    slots = slots.filter(other => other.hwnd !== slot.hwnd)

    if (slots.length === 0) {
      setHover(false)
      native.previewHide().catch(() => undefined)
    }
  }
</script>

<div
  role="presentation"
  class="relative h-full w-full rounded-box bg-base-100/70 shadow-2xl ring-1 ring-base-content/10 ring-inset backdrop-blur-2xl"
  onmouseenter={() => setHover(true)}
  onmouseleave={() => setHover(false)}
>
  {#each slots as slot (slot.hwnd)}
    <div
      class="absolute"
      style:left="{slot.x}px"
      style:top="{slot.y}px"
      style:width="{slot.width}px"
      style:height="{slot.height}px"
      role="group"
      onmouseenter={() => (hovered = slot.hwnd)}
      onmouseleave={() => (hovered = null)}
    >
      <button
        type="button"
        class="absolute inset-0 transition-shadow duration-150"
        class:selected={hovered === slot.hwnd}
        aria-label={$t("dock.preview.switchTo")}
        onclick={() => pick(slot)}
      ></button>

      {#if hovered === slot.hwnd}
        <button
          type="button"
          class="btn btn-circle btn-sm absolute top-1.5 right-1.5 border-0 bg-base-content text-base-100 shadow-lg ring-2 ring-base-100/60 hover:bg-error hover:text-error-content"
          aria-label={$t("dock.preview.close")}
          onclick={() => close(slot)}
        >
          <Icon icon="lucide:x" class="size-4" />
        </button>
      {/if}
    </div>
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
