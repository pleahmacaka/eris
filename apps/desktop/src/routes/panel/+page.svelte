<script lang="ts">
  import Icon from "@iconify/svelte"
  import { Aura } from "@eris/ui"
  import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi"
  import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window"
  import { t } from "svelte-i18n"
  import EventDetail from "$lib/panel/EventDetail.svelte"
  import { longDay } from "$lib/calendar"
  import { dateKey } from "$lib/data"
  import * as native from "$lib/native"
  import {
    CompactPanel,
    MonthGrid,
    Morph,
    Panel,
    PanelAside,
    PanelHeader,
  } from "$lib/panel"

  const PICKER_TYPES = ["date", "datetime-local", "time", "color", "file"]
  const BLUR_GRACE = 400

  document.documentElement.dataset.surface = "panel"

  const appWindow = getCurrentWindow()
  const panel = new Panel()
  const morph = new Morph()

  const DETAIL_WIDTH = 364

  let focusLanded = false
  let shownAt = 0

  let detailSide = $state<"left" | "right">("right")
  let showDetail = $state(false)
  let detailClosing = $state(false)
  let widened = false
  let resizing = Promise.resolve()
  let closeTimer: ReturnType<typeof setTimeout> | null = null

  const detailKey = $derived(
    panel.view.kind === "event"
      ? `${panel.view.id}@${panel.view.date}`
      : "new",
  )

  const queue = (step: () => Promise<void>) => {
    resizing = resizing.then(step).catch(() => undefined)
  }

  const widen = () => queue(async () => {
    if (widened) {
      return
    }

    const scale = await appWindow.scaleFactor()
    const pos = await appWindow.outerPosition()
    const size = await appWindow.outerSize()
    const monitor = await currentMonitor()

    if (!monitor) {
      return
    }

    const add = Math.round(DETAIL_WIDTH * scale)
    const left = monitor.position.x
    const right = monitor.position.x + monitor.size.width

    detailSide =
      right - (pos.x + size.width) >= add || pos.x - left < add ? "right" : "left"

    if (detailSide === "left") {
      await appWindow.setPosition(new PhysicalPosition(pos.x - add, pos.y))
    }

    await appWindow.setSize(new PhysicalSize(size.width + add, size.height))
    widened = true
  })

  const unwiden = () => queue(async () => {
    if (!widened) {
      return
    }

    widened = false

    const scale = await appWindow.scaleFactor()
    const pos = await appWindow.outerPosition()
    const size = await appWindow.outerSize()
    const add = Math.round(DETAIL_WIDTH * scale)

    await appWindow.setSize(new PhysicalSize(size.width - add, size.height))

    if (detailSide === "left") {
      await appWindow.setPosition(new PhysicalPosition(pos.x + add, pos.y))
    }
  })

  const isPicker = (el: Element | null) =>
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLInputElement && PICKER_TYPES.includes(el.type))

  const hide = () => {
    focusLanded = false

    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }

    showDetail = false
    detailClosing = false
    panel.close()
    unwiden()
    native.hideWindow("panel")
  }

  const collapse = () => {
    panel.close()
    morph.collapse()
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") {
      return
    }

    if (panel.asking) {
      panel.asking.answer(null)
    } else if (panel.detailOpen) {
      panel.close()
    } else if (morph.expanded && panel.calendarOn && panel.device.panelStart === "compact") {
      collapse()
    } else {
      hide()
    }
  }

  $effect(() => {
    if (!panel.calendarOn) {
      native.setWindowRegion(null).catch(() => undefined)
    }
  })

  $effect(() => {
    if (panel.detailOpen) {
      if (closeTimer) {
        clearTimeout(closeTimer)
        closeTimer = null
        detailClosing = false
      }

      if (!showDetail) {
        showDetail = true
        detailClosing = false
        widen()
      }
    } else if (showDetail && !detailClosing) {
      detailClosing = true
      closeTimer = setTimeout(() => {
        showDetail = false
        detailClosing = false
        closeTimer = null
        panel.kept = null
        unwiden()
      }, 200)
    }
  })

  $effect(() => {
    native.takeIntent("panel").catch(() => undefined)

    const stop = panel.start()

    const stops = [
      appWindow.onFocusChanged(({ payload: focused }) => {
        if (focused) {
          if (!focusLanded) {
            focusLanded = true
            shownAt = Date.now()
          }

          return
        }

        const settling = Date.now() - shownAt < BLUR_GRACE

        if (focusLanded && !settling && !isPicker(document.activeElement)) {
          hide()
        }
      }),
      native.onWindowShown("panel", () => {
        focusLanded = false
        shownAt = Date.now()
        panel.reset()
        morph.reset(panel.device.panelStart === "full")
      }),
    ]

    return () => {
      stop()

      for (const unlisten of stops) {
        unlisten.then(fn => fn())
      }
    }
  })
</script>

<svelte:window {onkeydown} onresize={morph.fit} />

{#snippet detailBody()}
  {#key detailKey}
    <EventDetail {panel} />
  {/key}
{/snippet}

{#if !panel.calendarOn}
  <main class="panel-surface flex h-full min-h-0 flex-col">
    <header class="flex items-center justify-end px-3 py-2">
      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("common.close")}
        onclick={hide}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    </header>

    <div
      class={[
        "flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5",
        "px-6 pb-4 text-center",
      ]}
    >
      <p class="text-2xl font-semibold tracking-tight text-balance">
        {longDay(panel.today)}
      </p>
      <p class="text-sm tabular-nums text-base-content/55">
        {dateKey(panel.today)}
      </p>
    </div>
  </main>
{:else}
  <div
    class={[
      "compact absolute flex gap-3",
      panel.anchorTop ? "top-0 items-start" : "bottom-0 items-end",
      panel.device.panelPosition === "left"
        ? "left-0"
        : panel.device.panelPosition === "center"
          ? "left-1/2 -translate-x-1/2"
          : "right-0",
      morph.expanded && "folded",
    ]}
    inert={morph.expanded}
  >
    <CompactPanel {panel} {morph} />

    {#if showDetail && !morph.expanded}
      <section
        {@attach morph.card}
        class={[
          "detail panel-surface flex h-[38rem] max-h-screen w-[22rem] flex-col",
          detailSide === "left" ? "order-first from-left" : "from-right",
          detailClosing && "closing",
        ]}
        inert={detailClosing}
      >
        {@render detailBody()}
      </section>
    {/if}
  </div>

  <div
    class={["full absolute inset-0", !morph.expanded && "folded"]}
    style:clip-path={morph.clipPath}
    inert={!morph.expanded}
    ontransitionend={morph.settle}
  >
    <div
      class={[
        "base absolute top-0 bottom-0 grid grid-cols-[minmax(0,1fr)_22rem] gap-3",
        detailSide === "left" ? "right-0" : "left-0",
      ]}
      style:width={showDetail ? `calc(100% - ${DETAIL_WIDTH}px)` : "100%"}
    >
      <main class="panel-surface flex min-h-0 flex-col">
        <Aura />
        <PanelHeader {panel} {collapse} {hide} />

        <div class="flex min-h-0 flex-1 flex-col px-2 pb-2">
          <MonthGrid {panel} />
        </div>
      </main>

      <PanelAside {panel} />
    </div>

    {#if showDetail && morph.expanded}
      <div
        class={[
          "detail absolute top-0 bottom-0 flex w-[22rem]",
          detailSide === "left" ? "left-0 from-left" : "right-0 from-right",
          detailClosing && "closing",
        ]}
        inert={detailClosing}
      >
        <section class="panel-surface flex min-h-0 w-full flex-col">
          {@render detailBody()}
        </section>
      </div>
    {/if}
  </div>
{/if}

<style>
  :global(.siri-aura) {
    mask-image: none;
  }

  .compact {
    transition: opacity 200ms ease-out 160ms;
  }

  .compact:global(.folded) {
    opacity: 0;
    pointer-events: none;
    transition: opacity 140ms ease-out;
  }

  .full {
    transition:
      clip-path 380ms cubic-bezier(0.2, 0.9, 0.1, 1),
      opacity 120ms ease-out;
  }

  .full:global(.folded) {
    opacity: 0;
    pointer-events: none;
    transition:
      clip-path 380ms cubic-bezier(0.2, 0.9, 0.1, 1),
      opacity 140ms ease-in 240ms;
  }

  .detail {
    transition:
      transform 200ms cubic-bezier(0.2, 0.9, 0.1, 1),
      opacity 180ms ease-out;
  }

  .detail.from-right {
    animation: detail-in-right 220ms cubic-bezier(0.2, 0.9, 0.1, 1);
  }

  .detail.from-left {
    animation: detail-in-left 220ms cubic-bezier(0.2, 0.9, 0.1, 1);
  }

  .detail.closing {
    opacity: 0;
  }

  .detail.from-right.closing {
    transform: translateX(1rem);
  }

  .detail.from-left.closing {
    transform: translateX(-1rem);
  }

  @keyframes detail-in-right {
    from {
      opacity: 0;
      transform: translateX(1rem);
    }
  }

  @keyframes detail-in-left {
    from {
      opacity: 0;
      transform: translateX(-1rem);
    }
  }
</style>
