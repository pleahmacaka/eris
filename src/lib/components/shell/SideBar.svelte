<script lang="ts">
  import Icon from "@iconify/svelte"
  import { rem } from "$lib/ascii/motion"
  import PanelView from "$lib/components/panels/PanelView.svelte"
  import ActivityBar from "./ActivityBar.svelte"
  import {
    accept,
    drag,
    endDrag,
    payload,
    startDrag,
  } from "$lib/workspace/drag.svelte"
  import {
    layout,
    movePanel,
    PANELS,
    type PanelId,
    resizeSide,
    type Side,
  } from "$lib/workspace/layout.svelte"

  const { side }: { side: Side } = $props()

  const panels = $derived(layout.docks[side])

  const active = $derived(layout.active[side] ?? panels[0] ?? null)

  let hover = $state<PanelId | "end" | null>(null)
  let resizing = $state(false)

  const open = $derived(layout.open[side])

  const drop = (event: DragEvent, before?: PanelId) => {
    event.stopPropagation()

    const panel = payload(event, "panel") as PanelId

    if (panel in PANELS) {
      movePanel(panel, side, before)
    }

    hover = null
    endDrag()
  }

  const resize = (event: PointerEvent) => {
    const handle = event.currentTarget as HTMLElement
    const start = event.clientX
    const width = layout.width[side]
    const unit = rem(1)

    handle.setPointerCapture(event.pointerId)
    resizing = true

    const moveTo = (e: PointerEvent) => {
      const delta = (e.clientX - start) / unit

      resizeSide(side, side === "left" ? width + delta : width - delta)
    }

    const stop = () => {
      resizing = false
      handle.removeEventListener("pointermove", moveTo)
      handle.removeEventListener("pointerup", stop)
    }

    handle.addEventListener("pointermove", moveTo)
    handle.addEventListener("pointerup", stop)
  }
</script>

{#if active}
  <aside
    class={[
      "pad-bottom relative flex shrink-0 overflow-hidden bg-base-100",
      "border-base-content/10 ease-out max-lg:fixed max-lg:inset-y-0",
      "max-lg:z-40 max-lg:w-72!",
      resizing ? "transition-none" : "transition-all duration-200",
      side === "left" ? "max-lg:left-0" : "max-lg:right-0",
      open && (side === "left" ? "border-r" : "border-l"),
      !open && (side === "left" ? "max-lg:-translate-x-full" : "max-lg:translate-x-full"),
      drag.kind === "panel" && "ring-1 ring-primary/40 ring-inset",
    ]}
    style:width="{open ? layout.width[side] : 0}rem"
    inert={!open}
    aria-label={side === "left" ? "왼쪽 사이드바" : "오른쪽 사이드바"}
    ondragover={e => accept(e, "panel")}
    ondrop={e => drop(e)}
  >
    <div
      class="flex h-full shrink-0 flex-col max-lg:w-full!"
      style:width="{layout.width[side]}rem"
    >
    {#if side === "left"}
      <div class="lg:hidden">
        <ActivityBar horizontal />
      </div>
    {:else}
      <div
        class="flex h-9 shrink-0 items-stretch border-b border-base-content/10"
        role="tablist"
      >
        {#each panels as panel (panel)}
          {@const on = panel === active}
          <button
            role="tab"
            aria-selected={on}
            draggable="true"
            class={[
              "relative flex cursor-pointer items-center gap-1.5 px-3 text-xs",
              on ? "text-base-content" : "text-base-content/50 hover:text-base-content",
              hover === panel && "bg-primary/10",
            ]}
            title={PANELS[panel].label}
            onclick={() => (layout.active[side] = panel)}
            ondragstart={e => startDrag(e, "panel", panel)}
            ondragend={endDrag}
            ondragenter={() => (hover = panel)}
            ondragleave={() => (hover = null)}
            ondragover={e => accept(e, "panel")}
            ondrop={e => drop(e, panel)}
          >
            {#if on}
              <span class="absolute inset-x-2 bottom-0 h-0.5 bg-primary"></span>
            {/if}
            <Icon icon={PANELS[panel].icon} class="size-4" />
            <span class={[panels.length > 2 && "sr-only"]}>
              {PANELS[panel].label}
            </span>
          </button>
        {/each}
      </div>
    {/if}

    <PanelView panel={active} />
    </div>

    <div
      class={[
        "absolute inset-y-0 w-1 cursor-col-resize transition hover:bg-primary/40",
        "max-lg:hidden",
        side === "left" ? "-right-0.5" : "-left-0.5",
      ]}
      role="separator"
      aria-orientation="vertical"
      aria-label="사이드바 너비"
      onpointerdown={resize}
    ></div>
  </aside>
{/if}
