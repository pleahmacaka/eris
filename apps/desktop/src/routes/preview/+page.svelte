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
    header: number
    title: string
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
    {@const active = hovered === slot.hwnd}

    <div
      class={[
        "absolute rounded-field transition-colors duration-100",
        active ? "bg-base-content/10" : "bg-transparent",
      ]}
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
        class="absolute inset-0 rounded-field outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={$t("dock.preview.switchTo")}
        onclick={() => pick(slot)}
      ></button>

      <div
        class="pointer-events-none relative flex items-center gap-2 pr-1 pl-2"
        style:height="{slot.header}px"
      >
        <span class="min-w-0 flex-1 truncate text-xs text-base-content/80">{slot.title}</span>

        <button
          type="button"
          class={[
            "btn btn-square btn-ghost btn-xs pointer-events-auto text-base-content transition-opacity duration-100 hover:bg-error hover:text-error-content",
            active ? "opacity-100" : "opacity-0 focus-visible:opacity-100",
          ]}
          aria-label={$t("dock.preview.close")}
          onclick={() => close(slot)}
        >
          <Icon icon="lucide:x" class="size-4" />
        </button>
      </div>
    </div>
  {/each}
</div>
