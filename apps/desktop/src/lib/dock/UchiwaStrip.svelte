<script lang="ts">
  import { onMount } from "svelte"
  import { t } from "svelte-i18n"
  import { EditSpot } from "$lib/edit"
  import { dock } from "./dock.svelte"
  import DockItem from "./DockItem.svelte"
  import EditOptions from "./EditOptions.svelte"
  import {
    FAN_ARC,
    FAN_STEP,
    fanBand,
    fanOrbit,
    fanOuter,
    fanSpan,
    type DockLayout,
  } from "./layout.svelte"

  let { layout }: { layout: DockLayout } = $props()

  const device = $derived(layout.device)

  const spotClaim = $derived(layout.claimFor("spot-fan"))
  const itemsClaim = $derived(layout.claimFor("fan-items"))

  const groups = $derived(layout.shown)

  const icon = $derived(device.dockIconSize)
  const slot = $derived(icon + 16)
  const arc = $derived(fanOrbit(groups.length))
  const thick = $derived(fanBand(icon))
  const outer = $derived(fanOuter(groups.length, icon))
  const inner = $derived(arc - thick / 2)
  const orbit = $derived(arc - slot / 2)
  const span = $derived(fanSpan(groups.length, icon))
  const hub = $derived(Math.max(18, inner * 0.32))

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
      focus = clamp(dragFocus - Math.round(dx / 22))
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
      x: orbit * Math.sin(angle),
      y: orbit * Math.cos(angle),
      visible,
      fade: visible ? Math.max(fade, 0.35) : fade,
      scale: 1 - Math.min(0.25, (Math.abs(deg) / FAN_ARC) * 0.25),
    }
  }

  let stripEl = $state<HTMLDivElement>()

  const claim = () => {
    const el = stripEl
    const hidden = layout.hiding || layout.collapsed || layout.dockHidden

    if (!el || hidden) {
      layout.fanRing = null
      return
    }

    const rect = el.getBoundingClientRect()

    layout.fanRing = [rect.left + rect.width / 2, rect.bottom, outer, thick]
  }

  $effect(() => {
    void outer
    void thick
    void layout.dockWidth

    const raf = requestAnimationFrame(claim)

    return () => cancelAnimationFrame(raf)
  })

  $effect(() => {
    if (layout.hiding || layout.collapsed || layout.dockHidden) {
      layout.fanRing = null
    }
  })

  onMount(() => {
    const observer = new ResizeObserver(claim)

    observer.observe(document.documentElement)

    return () => {
      observer.disconnect()
      layout.fanRing = null
    }
  })
</script>

<EditSpot id="apps" label={$t("edit.spots.apps")} placement={layout.spotPlacement} onmenu={spotClaim}>
  {#snippet options()}
    <EditOptions {layout} kind="apps" />
  {/snippet}

  <div
    bind:this={stripEl}
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
    <div
      aria-hidden="true"
      class="absolute bottom-0 left-1/2 -translate-x-1/2 overflow-hidden"
      style:width="{2 * outer}px"
      style:height="{outer}px"
    >
      <div
        class="fan-ring absolute top-0 left-0"
        style:width="{2 * outer}px"
        style:height="{2 * outer}px"
        style:--inner="{inner}px"
        style:--outer="{outer}px"
      ></div>

      <div
        class="fan-ribs absolute top-0 left-0"
        style:width="{2 * outer}px"
        style:height="{2 * outer}px"
        style:--inner="{inner}px"
        style:--outer="{outer}px"
        style:transform="rotate({-pivot * FAN_STEP}deg)"
      ></div>

      <div
        class="fan-hub absolute bottom-0 left-1/2 -translate-x-1/2"
        style:width="{2 * hub}px"
        style:height="{hub}px"
        style:border-radius="{hub}px {hub}px 0 0"
      ></div>
    </div>

    {#each groups as group, index (group.key)}
      {@const pose = blade(index)}

      <div
        class="absolute bottom-0 left-1/2"
        style:width="{slot}px"
        style:height="{slot}px"
        style:transform="translate(-50%, 0) translate({pose.x}px, {-pose.y}px) rotate({pose.deg}deg) scale({pose.scale})"
        style:opacity={pose.fade}
        style:pointer-events={pose.visible ? "auto" : "none"}
        style:z-index={Math.round(100 - Math.abs(pose.deg))}
        style:transition="transform 140ms cubic-bezier(0.22, 1, 0.36, 1), opacity 120ms ease-out"
      >
        <DockItem
          {group}
          size={icon}
          edge={device.dockEdge}
          mac={false}
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

<style>
  .fan-ring {
    border-radius: 50%;
    background-color: color-mix(
      in oklch,
      var(--color-base-100) 58%,
      transparent
    );
    background-image:
      radial-gradient(
        circle at 50% 50%,
        transparent 0 calc(var(--inner) - 0.5px),
        color-mix(in oklch, var(--color-base-content) 16%, transparent)
          calc(var(--inner) - 0.5px) calc(var(--inner) + 0.5px),
        transparent calc(var(--inner) + 0.5px) calc(var(--outer) - 0.5px),
        color-mix(in oklch, var(--color-base-content) 16%, transparent)
          calc(var(--outer) - 0.5px) calc(var(--outer) + 0.5px),
        transparent calc(var(--outer) + 0.5px)
      ),
      linear-gradient(
        oklch(62% calc(var(--vividness) + 0.08) var(--accent-hue) / var(--dock-tint, 0)),
        oklch(62% calc(var(--vividness) + 0.08) var(--accent-hue) / var(--dock-tint, 0))
      );
    mask-image: radial-gradient(
      circle at 50% 50%,
      transparent 0 var(--inner),
      black var(--inner) var(--outer),
      transparent var(--outer)
    );
  }

  .fan-ribs {
    border-radius: 50%;
    background:
      conic-gradient(
        from 355.5deg,
        oklch(65% calc(var(--vividness) + 0.1) var(--accent-hue) / 0.3)
          0deg
          9deg,
        transparent 9deg
      ),
      repeating-conic-gradient(
        from 0deg,
        transparent 0deg calc(9deg - 0.4deg),
        oklch(65% calc(var(--vividness) + 0.1) var(--accent-hue) / 0.16)
          calc(9deg - 0.4deg)
          9deg
      );
    mask-image: radial-gradient(
      circle at 50% 50%,
      transparent 0 var(--inner),
      black var(--inner) var(--outer),
      transparent var(--outer)
    );
    transition: transform 140ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .fan-hub {
    background-color: color-mix(
      in oklch,
      var(--color-base-100) 58%,
      transparent
    );
    background-image: linear-gradient(
      oklch(62% calc(var(--vividness) + 0.08) var(--accent-hue) / var(--dock-tint, 0)),
      oklch(62% calc(var(--vividness) + 0.08) var(--accent-hue) / var(--dock-tint, 0))
    );
    border: 1px solid color-mix(in oklch, var(--color-base-content) 16%, transparent);
    border-bottom: none;
  }
</style>
