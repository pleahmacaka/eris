<script lang="ts">
  import { t } from "svelte-i18n"
  import { EditSpot } from "$lib/edit"
  import { dock } from "./dock.svelte"
  import DockItem from "./DockItem.svelte"
  import EditOptions from "./EditOptions.svelte"
  import {
    FAN_ARC,
    FAN_STEP,
    fanRadiusX,
    fanRadiusY,
    fanSpan,
    type DockLayout,
  } from "./layout.svelte"

  let { layout }: { layout: DockLayout } = $props()

  const device = $derived(layout.device)

  const spotClaim = $derived(layout.claimFor("spot-fan"))
  const itemsClaim = $derived(layout.claimFor("fan-items"))

  const groups = $derived(layout.shown)

  const rx = $derived(fanRadiusX(groups.length))
  const ry = $derived(fanRadiusY(device.dockHeight, device.dockIconSize))
  const span = $derived(fanSpan(groups.length, device.dockIconSize))

  const foreground = $derived(dock.windows[0]?.hwnd)

  let focus = $state(-1)

  const count = $derived(groups.length)

  const clamp = (value: number) =>
    Math.min(Math.max(0, value), Math.max(0, count - 1))

  const pivot = $derived(
    clamp(focus < 0 ? Math.floor((count - 1) / 2) : focus),
  )

  const rad = (deg: number) => (deg * Math.PI) / 180

  const spin = (delta: number) => {
    focus = clamp(Math.round(pivot + delta))
  }

  let wheelAcc = 0

  const onwheel = (e: WheelEvent) => {
    e.preventDefault()

    wheelAcc += e.deltaY === 0 ? e.deltaX : e.deltaY

    if (Math.abs(wheelAcc) >= 40) {
      spin(Math.sign(wheelAcc))
      wheelAcc = 0
    }
  }

  let dragFrom = $state<number | null>(null)
  let dragFocus = 0
  let dragged = false

  const onpointerdown = (e: PointerEvent) => {
    dragFrom = e.clientX
    dragFocus = pivot
    dragged = false
  }

  const onpointermove = (e: PointerEvent) => {
    if (dragFrom === null) {
      return
    }

    const dx = e.clientX - dragFrom

    if (Math.abs(dx) > 4) {
      dragged = true
    }

    if (dragged) {
      focus = clamp(dragFocus - dx / 28)
    }
  }

  const onpointerup = () => {
    if (dragged) {
      focus = clamp(Math.round(pivot))
    }

    dragFrom = null
  }

  const swallowDragClick = (node: HTMLElement) => {
    const suppress = (e: MouseEvent) => {
      if (dragged) {
        e.preventDefault()
        e.stopPropagation()
        dragged = false
      }
    }

    node.addEventListener("click", suppress, true)

    return {
      destroy: () => node.removeEventListener("click", suppress, true),
    }
  }

  const blade = (index: number) => {
    const deg = (index - pivot) * FAN_STEP
    const angle = rad(deg)
    const visible = Math.abs(deg) <= FAN_ARC
    const fade = Math.min(1, Math.max(0, (FAN_ARC + 8 - Math.abs(deg)) / 8))

    return {
      deg,
      x: rx * Math.sin(angle),
      y: ry * Math.cos(angle),
      visible,
      fade: visible ? Math.max(fade, 0.35) : fade,
      scale: 1 - Math.min(0.25, (Math.abs(deg) / FAN_ARC) * 0.25),
    }
  }
</script>

<EditSpot id="apps" label={$t("edit.spots.apps")} placement={layout.spotPlacement} onmenu={spotClaim}>
  {#snippet options()}
    <EditOptions {layout} kind="apps" />
  {/snippet}

  <div
    role="toolbar"
    tabindex="-1"
    aria-label={$t("dock.apps")}
    class="relative h-full touch-none select-none"
    style:width="{span}px"
    {onwheel}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    use:swallowDragClick
  >
    {#each groups as group, index (group.key)}
      {@const pose = blade(index)}

      <div
        class="absolute bottom-0 left-1/2"
        style:width="{device.dockIconSize + 16}px"
        style:height="{device.dockIconSize + 16}px"
        style:transform="translate(-50%, 0) translate({pose.x}px, {-pose.y}px) rotate({pose.deg}deg) scale({pose.scale})"
        style:opacity={pose.fade}
        style:pointer-events={pose.visible ? "auto" : "none"}
        style:z-index={Math.round(100 - Math.abs(pose.deg))}
        style:transition="transform 140ms cubic-bezier(0.22, 1, 0.36, 1), opacity 120ms ease-out"
      >
        <DockItem
          {group}
          size={device.dockIconSize}
          edge={device.dockEdge}
          mac={true}
          {foreground}
          alignEnd={pose.deg > 0}
          hiddenHere={layout.hidden.has(group.path)}
          reorder={false}
          onmenu={itemsClaim}
        />
      </div>
    {/each}
  </div>
</EditSpot>
