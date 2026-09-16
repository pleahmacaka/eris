<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import type { DockWidget } from "@eris/settings"
  import { EditSpot, editing } from "$lib/edit"
  import type { DockLayout } from "./layout.svelte"

  let {
    layout,
    widget,
    index,
    count,
  }: {
    layout: DockLayout
    widget: DockWidget
    index: number
    count: number
  } = $props()

  const claim = $derived(layout.claimFor(`spot-${widget.id}`))

  let startX = 0
  let startSize = 0

  const grab = (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startX = e.clientX
    startSize = widget.size
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const drag = (e: PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      return
    }

    layout.resizeWidget(widget.id, startSize + e.clientX - startX, false)
  }

  const release = (e: PointerEvent) => {
    if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      return
    }

    layout.resizeWidget(widget.id, widget.size, true)
  }
</script>

{#if editing.on}
  <EditSpot
    id={`widget-${widget.id}`}
    label={$t("edit.spots.spacer")}
    placement={layout.spotPlacement}
    onmenu={claim}
  >
    {#snippet options()}
      <label class="flex flex-col gap-1">
        <span class="text-xs text-base-content/70">
          {$t("dock.spacerWidth")} · {widget.size}px
        </span>

        <input
          type="range"
          class="range range-primary range-xs w-full"
          min="8"
          max="240"
          step="4"
          aria-label={$t("dock.spacerWidth")}
          value={widget.size}
          oninput={e =>
            layout.resizeWidget(widget.id, Number(e.currentTarget.value), false)}
          onchange={e =>
            layout.resizeWidget(widget.id, Number(e.currentTarget.value), true)}
        />
      </label>

      <div class="mt-1 flex items-center gap-1">
        <button
          type="button"
          class="btn btn-ghost btn-xs"
          disabled={index === 0}
          aria-label={$t("dock.moveLeft")}
          onclick={() => layout.moveWidget(widget.id, -1)}
        >
          <Icon icon="lucide:arrow-left" class="size-3.5" />
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-xs"
          disabled={index === count - 1}
          aria-label={$t("dock.moveRight")}
          onclick={() => layout.moveWidget(widget.id, 1)}
        >
          <Icon icon="lucide:arrow-right" class="size-3.5" />
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-xs ml-auto text-error"
          onclick={() => layout.removeWidget(widget.id)}
        >
          <Icon icon="lucide:trash-2" class="size-3.5" />
          {$t("common.delete")}
        </button>
      </div>
    {/snippet}

    <div
      class="relative flex h-6 shrink-0 items-center justify-center rounded-field border border-dashed border-primary/50 bg-primary/5"
      style:width="{widget.size}px"
      role="presentation"
    >
      <button
        type="button"
        class="absolute top-1/2 -right-1.5 z-50 h-4 w-2.5 -translate-y-1/2 cursor-ew-resize rounded-sm bg-primary/70 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label={$t("dock.spacerWidth")}
        onpointerdown={grab}
        onpointermove={drag}
        onpointerup={release}
        onpointercancel={release}
      ></button>
    </div>
  </EditSpot>
{:else}
  <div class="h-full shrink-0" style:width="{widget.size}px" aria-hidden="true"></div>
{/if}
