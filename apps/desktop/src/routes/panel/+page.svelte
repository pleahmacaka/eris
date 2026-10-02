<script lang="ts">
  import Icon from "@iconify/svelte"
  import { Aura } from "@eris/ui"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { t } from "svelte-i18n"
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

  let focusLanded = false
  let shownAt = 0

  const isPicker = (el: Element | null) =>
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLInputElement && PICKER_TYPES.includes(el.type))

  const hide = () => {
    focusLanded = false
    panel.close()
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
    } else if (morph.expanded && panel.calendarOn) {
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
        morph.reset()
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

<svelte:window {onkeydown} />

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
      "compact absolute flex",
      panel.anchorTop ? "top-0" : "bottom-0",
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
  </div>

  <div
    class={[
      "full absolute inset-0 grid grid-cols-[minmax(0,1fr)_22rem] gap-3",
      !morph.expanded && "folded",
    ]}
    style:clip-path={morph.clipPath}
    inert={!morph.expanded}
    ontransitionend={morph.settle}
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
</style>
