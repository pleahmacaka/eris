<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { write } from "../pty"
  import Terminal from "../Terminal.svelte"
  import { drag, onTabDrop } from "./drag.svelte"
  import {
    type Divider,
    isSplit,
    panesOf,
    place,
    type Rect,
    type Side,
    sideAt,
  } from "./layout"
  import {
    bindPty,
    closePane,
    dropTab,
    session,
    type Tab,
  } from "./tabs.svelte"

  let {
    fontFamily,
    fontSize,
    visible = true,
  }: { fontFamily: string; fontSize: number; visible?: boolean } = $props()

  const MIN_PANE = 80
  const CORNER = { x: 120, y: 80 }
  const ESC = "\u001b"

  let area = $state<HTMLElement>()
  let near = $state(false)

  const current = $derived(session.tabs[session.active])

  const placed = $derived(
    session.tabs.flatMap(tab =>
      place(tab.root).panes.map(entry => ({ tab, ...entry })),
    ),
  )

  const dividers = $derived(current ? place(current.root).dividers : [])

  const target = $derived.by(() => {
    if (drag.tab === null || !area || !current || current.id === drag.tab) {
      return null
    }

    const box = area.getBoundingClientRect()
    const x = (drag.x - box.left) / box.width
    const y = (drag.y - box.top) / box.height
    const hit = place(current.root).panes.find(
      ({ rect }) =>
        x >= rect.x &&
        x < rect.x + rect.w &&
        y >= rect.y &&
        y < rect.y + rect.h,
    )

    if (!hit) {
      return null
    }

    const side = sideAt(
      (x - hit.rect.x) / hit.rect.w,
      (y - hit.rect.y) / hit.rect.h,
    )
    const source = session.tabs.find(tab => tab.id === drag.tab)

    if (side === "center" && (!source || isSplit(source.root))) {
      return null
    }

    return { pane: hit.pane, rect: hit.rect, side }
  })

  const half = (rect: Rect, side: Side | "center"): Rect => {
    switch (side) {
      case "left":
        return { ...rect, w: rect.w / 2 }
      case "right":
        return { ...rect, x: rect.x + rect.w / 2, w: rect.w / 2 }
      case "top":
        return { ...rect, h: rect.h / 2 }
      case "bottom":
        return { ...rect, y: rect.y + rect.h / 2, h: rect.h / 2 }
      case "center":
        return rect
    }
  }

  const preview = $derived(target ? half(target.rect, target.side) : null)

  $effect(() =>
    onTabDrop(tab => {
      if (target) {
        dropTab(tab, target.pane, target.side)
      }
    }),
  )

  // terminal replies (cursor and device reports, focus and mouse events) also arrive through onData
  const isReply = (data: string) => {
    if (data.startsWith(`${ESC}]`)) {
      return true
    }

    if (!data.startsWith(`${ESC}[`)) {
      return false
    }

    const body = [...data.slice(2, -1)]

    return (
      "RcnIOmM".includes(data.at(-1) ?? "") &&
      body.every(c => "0123456789;?<>".includes(c))
    )
  }

  const share = (tab: Tab, from: number, data: string) => {
    if (!tab.sync || isReply(data)) {
      return
    }

    for (const pane of panesOf(tab.root)) {
      if (pane.id !== from && pane.pty !== null) {
        write(pane.pty, data)
      }
    }
  }

  const resize = (e: PointerEvent, divider: Divider) => {
    if (!area || e.button !== 0) {
      return
    }

    e.preventDefault()

    const box = area.getBoundingClientRect()
    const row = divider.split.dir === "row"
    const extent = row ? divider.rect.w * box.width : divider.rect.h * box.height
    const origin = row
      ? box.left + divider.rect.x * box.width
      : box.top + divider.rect.y * box.height
    const sizes = divider.split.sizes
    const total = sizes.reduce((sum, size) => sum + size, 0)
    const min = Math.min(MIN_PANE / extent, divider.span / 2)

    const move = (m: PointerEvent) => {
      const at = ((row ? m.clientX : m.clientY) - origin) / extent
      const share = Math.min(
        Math.max(at - divider.start, min),
        divider.span - min,
      )

      sizes[divider.index] = share * total
      sizes[divider.index + 1] = (divider.span - share) * total
    }

    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }

    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const equalize = (divider: Divider) => {
    divider.split.sizes = divider.split.sizes.map(() => 1)
  }

  const onpointermove = (e: PointerEvent) => {
    const box = area?.getBoundingClientRect()

    near =
      !!box &&
      box.right - e.clientX < CORNER.x &&
      e.clientY - box.top < CORNER.y
  }
</script>

<main
  bind:this={area}
  class="relative min-h-0 grow bg-base-100"
  {onpointermove}
  onpointerleave={() => (near = false)}
>
  {#each placed as item (item.pane.id)}
    {@const shown = item.tab === current}
    {@const focused = item.tab.focus === item.pane.id}

    <div
      class={[
        "absolute py-1.5 pr-1 pl-3",
        !shown && "invisible",
        item.tab.sync && "ring-2 ring-warning/60 ring-inset",
        !item.tab.sync &&
          focused &&
          isSplit(item.tab.root) &&
          "ring-1 ring-primary/40 ring-inset",
      ]}
      style:left="{item.rect.x * 100}%"
      style:top="{item.rect.y * 100}%"
      style:width="{item.rect.w * 100}%"
      style:height="{item.rect.h * 100}%"
      onpointerdowncapture={() => (item.tab.focus = item.pane.id)}
    >
      <Terminal
        shell={item.pane.shell}
        cwd={item.pane.cwd}
        pty={item.pane.pty}
        {fontFamily}
        {fontSize}
        active={visible && shown && focused}
        ontitle={title => (item.pane.title = title || item.pane.title)}
        oninput={data => share(item.tab, item.pane.id, data)}
        onexit={() => closePane(item.pane.id)}
        onpty={id => bindPty(item.pane.id, id)}
      />
    </div>
  {/each}

  {#each dividers as divider (`${divider.split.id}:${divider.index}`)}
    {@const row = divider.split.dir === "row"}

    <div
      role="separator"
      aria-orientation={row ? "vertical" : "horizontal"}
      aria-label={$t("terminal.panes.resize")}
      class={[
        "group absolute z-10 flex items-center justify-center",
        row
          ? "w-2 -translate-x-1/2 cursor-col-resize"
          : "h-2 -translate-y-1/2 cursor-row-resize",
      ]}
      style:left="{(row
        ? divider.rect.x + divider.at * divider.rect.w
        : divider.rect.x) * 100}%"
      style:top="{(row
        ? divider.rect.y
        : divider.rect.y + divider.at * divider.rect.h) * 100}%"
      style:width={row ? undefined : `${divider.rect.w * 100}%`}
      style:height={row ? `${divider.rect.h * 100}%` : undefined}
      onpointerdown={e => resize(e, divider)}
      ondblclick={() => equalize(divider)}
    >
      <span
        class={[
          "bg-base-content/10 transition-colors group-hover:bg-primary/60",
          row ? "h-full w-px" : "h-px w-full",
        ]}
      ></span>
    </div>
  {/each}

  {#if preview}
    <div
      class="pointer-events-none absolute z-20 rounded-box border-2 border-primary/60 bg-primary/15 transition-all duration-100"
      style:left="{preview.x * 100}%"
      style:top="{preview.y * 100}%"
      style:width="{preview.w * 100}%"
      style:height="{preview.h * 100}%"
    ></div>
  {/if}

  {#if current}
    <button
      type="button"
      class={[
        "btn btn-circle btn-sm absolute top-2 right-3 z-30 transition-opacity duration-150",
        current.sync ? "btn-warning" : "btn-ghost bg-base-200/80",
        near
          ? "opacity-50 hover:opacity-100 focus-visible:opacity-100"
          : "pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100",
      ]}
      aria-pressed={current.sync}
      aria-label={$t("terminal.panes.sync")}
      title={$t("terminal.panes.sync")}
      onclick={() => (current.sync = !current.sync)}
    >
      <Icon icon="lucide:radio-tower" class="size-4" />
    </button>
  {/if}
</main>
