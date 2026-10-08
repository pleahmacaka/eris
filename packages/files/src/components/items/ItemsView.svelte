<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import { t } from "svelte-i18n"
  import { displayName, type Item } from "../../items"
  import { rootRem, track } from "@eris/ui"
  import type { Explorer } from "../../store/explorer.svelte"
  import { openMenu } from "../../store/menus"
  import { prefs, SORT_KEYS, VIEWS } from "../../store/prefs.svelte"
  import DetailsHeader from "./DetailsHeader.svelte"
  import ItemCell from "./ItemCell.svelte"
  import {
    HEADER,
    hitsOf,
    layoutOf,
    lineAt,
    lineSize,
    perLineOf,
    planOf,
    stepsOf,
  } from "./plan"

  type Band = { left: number; top: number; width: number; height: number }

  const SIDE_BUTTON = 3
  const DRAG_SLOP = 6
  const TYPEAHEAD_RESET = 900
  const VIEW_STEP_GAP = 150

  let { explorer }: { explorer: Explorer } = $props()

  let scroller = $state<HTMLDivElement>()
  let width = $state(0)
  let height = $state(0)
  let top = $state(0)
  let left = $state(0)
  let rem = $state(16)
  let band = $state<Band | null>(null)
  let typed = ""
  let typedAt = 0
  let steppedAt = 0

  const tab = $derived(explorer.tab)
  const items = $derived(explorer.visible)
  const sections = $derived(explorer.sections)
  const view = $derived(explorer.view)
  const layout = $derived(layoutOf(view, !!sections))
  const columns = $derived(layout.flow === "columns")
  const header = $derived(view === "details" ? HEADER : 0)
  const template = $derived(
    SORT_KEYS.map(key => `${prefs.columns[key]}rem`).join(" "),
  )
  const tableWidth = $derived(
    SORT_KEYS.reduce((sum, key) => sum + prefs.columns[key], 0) + 1,
  )
  const perLine = $derived(perLineOf(layout, width, height, rem))
  const plan = $derived(planOf(items, sections, layout, perLine))
  const offset = $derived(columns ? left : Math.max(0, top - header * rem))
  const viewport = $derived(columns ? width : height)
  const first = $derived(Math.max(0, lineAt(plan.lines, offset / rem) - 2))
  const last = $derived(
    Math.min(
      plan.lines.length,
      lineAt(plan.lines, (offset + viewport) / rem) + 3,
    ),
  )
  const visibleLines = $derived(plan.lines.slice(first, last))

  const measure = () => {
    if (scroller) {
      rem = rootRem()
      width = scroller.clientWidth
      height = scroller.clientHeight
    }
  }

  $effect(() => {
    if (!scroller) {
      return
    }

    const observer = new ResizeObserver(measure)

    observer.observe(scroller)
    measure()

    return () => observer.disconnect()
  })

  export const reveal = (key: string) => {
    const index = plan.lineOf.get(key)

    if (!scroller || index === undefined) {
      return
    }

    const line = plan.lines[index]
    const size = line.size * rem
    const start = line.start * rem

    if (columns) {
      if (start < scroller.scrollLeft) {
        scroller.scrollLeft = start
      } else if (start + size > scroller.scrollLeft + width) {
        scroller.scrollLeft = start + size - width
      }

      return
    }

    const visibleTop = scroller.scrollTop
    const visibleHeight = height - header * rem

    if (start < visibleTop) {
      scroller.scrollTop = start
    } else if (start + size > visibleTop + visibleHeight) {
      scroller.scrollTop = start + size - visibleHeight
    }
  }

  const pageSize = () =>
    Math.max(
      1,
      Math.floor((viewport - header * rem) / (lineSize(layout) * rem)),
    ) * perLine

  const typeahead = (char: string) => {
    const now = performance.now()

    typed = now - typedAt > TYPEAHEAD_RESET ? char : typed + char
    typedAt = now

    const needle = typed.toLowerCase()
    const start = Math.max(
      0,
      items.findIndex(item => item.key === tab.focus),
    )
    const skip = needle.length === 1 ? 1 : 0

    for (let step = skip; step < items.length + skip; step++) {
      const item = items[(start + step) % items.length]
      const name = displayName(item, prefs.showExtensions).toLowerCase()

      if (name.startsWith(needle)) {
        tab.select([item.key])
        reveal(item.key)

        return
      }
    }
  }

  export const navigate = (e: KeyboardEvent) => {
    if (!items.length) {
      return false
    }

    const keys = items.map(item => item.key)
    const index = tab.focus ? keys.indexOf(tab.focus) : -1
    const steps = stepsOf(layout, perLine, pageSize())

    let next: number

    if (e.key === "Home") {
      next = 0
    } else if (e.key === "End") {
      next = keys.length - 1
    } else if (steps[e.key]) {
      next = index < 0 ? 0 : index + steps[e.key]
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      typeahead(e.key)

      return true
    } else {
      return false
    }

    const key = keys[Math.min(keys.length - 1, Math.max(0, next))]

    if (e.shiftKey) {
      tab.extendTo(keys, key, false)
    } else if (e.ctrlKey) {
      tab.focus = key
    } else {
      tab.select([key])
    }

    reveal(key)

    return true
  }

  const pick = (item: Item, e: PointerEvent) => {
    if (e.button >= SIDE_BUTTON) {
      return
    }

    scroller?.focus({ preventScroll: true })

    if (e.button === 2 && tab.selection.has(item.key)) {
      return
    }

    if (e.shiftKey && tab.anchor) {
      tab.extendTo(
        items.map(entry => entry.key),
        item.key,
        e.ctrlKey,
      )
    } else if (e.ctrlKey) {
      tab.toggle(item.key)
    } else {
      tab.select([item.key])
    }
  }

  const press = (item: Item, e: PointerEvent) => {
    if (e.button === 1) {
      return
    }

    const keep =
      e.button === 0 &&
      !e.ctrlKey &&
      !e.shiftKey &&
      tab.selection.has(item.key)

    if (keep) {
      scroller?.focus({ preventScroll: true })
    } else {
      pick(item, e)
    }

    if (e.button !== 0 || tab.renaming) {
      return
    }

    let dragged = false

    const stop = track(
      e,
      next => {
        if (
          Math.hypot(next.clientX - e.clientX, next.clientY - e.clientY) <
          DRAG_SLOP
        ) {
          return
        }

        dragged = true
        stop()
        explorer.drag()
      },
      () => {
        if (keep && !dragged) {
          tab.select([item.key])
        }
      },
    )
  }

  const stepView = (e: WheelEvent) => {
    if (!e.ctrlKey) {
      return
    }

    e.preventDefault()

    if (
      !explorer.arrangeable ||
      e.deltaY === 0 ||
      e.timeStamp - steppedAt < VIEW_STEP_GAP
    ) {
      return
    }

    const next = VIEWS[VIEWS.indexOf(explorer.view) + Math.sign(e.deltaY)]

    if (next) {
      steppedAt = e.timeStamp
      explorer.setView(next)
    }
  }

  const lasso = (e: PointerEvent, element: HTMLDivElement) => {
    const box = element.getBoundingClientRect()
    const point = (event: PointerEvent) => ({
      x: event.clientX - box.left + element.scrollLeft,
      y: event.clientY - box.top + element.scrollTop,
    })
    const origin = point(e)
    const base = e.ctrlKey ? [...tab.selection] : []

    track(
      e,
      next => {
        const end = point(next)
        const area = {
          left: Math.min(origin.x, end.x),
          top: Math.min(origin.y, end.y),
          width: Math.abs(end.x - origin.x),
          height: Math.abs(end.y - origin.y),
        }

        if (!band && area.width + area.height < DRAG_SLOP) {
          return
        }

        band = area

        const found = hitsOf(plan, layout, area, rem, header, tableWidth)

        tab.select([...base, ...found], tab.focus)
      },
      () => {
        band = null
      },
    )
  }

  const background = (e: PointerEvent) => {
    const target = e.target as HTMLElement

    if (e.button >= SIDE_BUTTON || !scroller) {
      return
    }

    if (target !== e.currentTarget && !target.dataset.fill) {
      return
    }

    scroller.focus({ preventScroll: true })

    if (!e.ctrlKey && !e.shiftKey) {
      tab.select([])
    }

    if (e.button === 0) {
      lasso(e, scroller)
    }
  }

  let revealed: string | null = null
  let shownAt = ""

  $effect(() => {
    const place = `${tab.id}:${tab.location}`
    const focus = tab.focus

    void items.length

    untrack(() => {
      if (place !== shownAt) {
        shownAt = place
        scroller?.scrollTo(0, 0)
        revealed = null
      }

      if (focus && focus !== revealed) {
        revealed = focus
        reveal(focus)
      }
    })
  })
</script>

<div
  bind:this={scroller}
  role="grid"
  tabindex="0"
  aria-multiselectable="true"
  aria-label={explorer.title(tab, $t)}
  class="relative min-h-0 min-w-0 grow overflow-auto outline-none"
  onscroll={e => {
    top = e.currentTarget.scrollTop
    left = e.currentTarget.scrollLeft
  }}
  onpointerdown={background}
  onwheel={stepView}
  oncontextmenu={e => {
    e.stopPropagation()
    openMenu(explorer, e, null)
  }}
>
  {#if band}
    <div
      aria-hidden="true"
      class="pointer-events-none absolute z-20 rounded-sm border border-primary/60 bg-primary/15"
      style:left="{band.left}px"
      style:top="{band.top}px"
      style:width="{band.width}px"
      style:height="{band.height}px"
    ></div>
  {/if}

  {#if view === "details"}
    <DetailsHeader
      {explorer}
      {template}
      width={tableWidth}
      shown={visibleLines.flatMap(line => line.items)}
    />
  {/if}

  <div
    data-fill="true"
    class="relative"
    style:height={columns ? "100%" : `${plan.total}rem`}
    style:width={columns
      ? `${plan.total}rem`
      : view === "details"
        ? `${tableWidth}rem`
        : "100%"}
  >
    {#each visibleLines as line (line.key)}
      {#if line.section}
        <div
          class={[
            "absolute left-0 flex w-full items-end gap-2 px-3 pb-1.5 text-xs",
            "text-base-content/60",
          ]}
          style:top="{line.start}rem"
          style:height="{line.size}rem"
        >
          <span class="shrink-0 font-semibold text-base-content/80">
            {line.section.label}
          </span>

          <span class="shrink-0 tabular-nums">{line.section.items.length}</span>

          <span class="mb-1.5 h-px grow bg-base-content/10"></span>
        </div>
      {:else}
        <div
          data-fill="true"
          class={["absolute grid", columns ? "top-0" : "left-0 w-full"]}
          style:top={columns ? undefined : `${line.start}rem`}
          style:left={columns ? `${line.start}rem` : undefined}
          style:grid-template-columns={layout.flow === "grid"
            ? `repeat(${perLine}, ${layout.width}rem)`
            : columns
              ? `${layout.width}rem`
              : undefined}
          style:grid-auto-rows="{layout.height}rem"
        >
          {#each line.items as item (item.key)}
            <ItemCell
              {explorer}
              {item}
              icon={layout.icon}
              {template}
              onpress={press}
            />
          {/each}
        </div>
      {/if}
    {/each}
  </div>

  {#if !items.length}
    <div
      class={[
        "pointer-events-none absolute inset-0 flex flex-col items-center",
        "justify-center gap-2 text-sm text-base-content/50",
      ]}
    >
      {#if tab.loading || tab.searching}
        <span class="loading loading-spinner loading-md text-primary"></span>
      {:else if tab.error}
        <Icon icon="lucide:circle-alert" class="size-6" />
        {$t(`explorer.states.${tab.error}`, { default: tab.error })}

        {#if tab.error === "unreachable" || tab.error === "notReady"}
          <button
            type="button"
            class="btn btn-sm pointer-events-auto mt-1"
            onclick={() => tab.refresh()}
          >
            <Icon icon="lucide:refresh-cw" class="size-3.5" />
            {$t("explorer.states.reconnect")}
          </button>
        {/if}
      {:else if tab.results}
        {$t("explorer.states.noResults")}
      {:else}
        {$t("explorer.states.empty")}
      {/if}
    </div>
  {/if}
</div>
