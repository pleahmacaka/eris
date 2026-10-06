<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import { eventSpan, eventTime, longDay } from "$lib/calendar"
  import {
    type CalendarEvent,
    dateKey,
    isDone,
    splitCitations,
  } from "$lib/data"
  import { colorMeta, toColor } from "./colors"
  import type { Panel } from "./panel.svelte"

  const { panel }: { panel: Panel } = $props()

  const CHIPS = 3
  const PREVIEW_DELAY = 350
  const PREVIEW_WIDTH = 256
  const PREVIEW_HEIGHT = 160
  const PREVIEW_GAP = 4
  const NOTE_LINES = 3

  type Preview = { event: CalendarEvent; left: number; top: number }

  let anchor = $state<Date | null>(null)
  let reach = $state<Date | null>(null)
  let preview = $state<Preview | null>(null)
  let previewTimer: ReturnType<typeof setTimeout> | undefined

  const ordered = (from: Date | null, to: Date | null) => {
    if (!from || !to) {
      return null
    }

    return from <= to ? [from, to] : [to, from]
  }

  const dragged = $derived(ordered(anchor, reach))

  const range = $derived(dragged ?? panel.range)

  const inRange = (day: Date) =>
    range !== null && day >= range[0] && day <= range[1]

  const startDrag = (e: PointerEvent, day: Date) => {
    if (e.button !== 0 || (e.target as Element).closest("button")) {
      return
    }

    anchor = day
    reach = day
  }

  const extendDrag = (day: Date) => {
    if (anchor) {
      reach = day
    }
  }

  const endDrag = () => {
    if (dragged && dateKey(dragged[0]) !== dateKey(dragged[1])) {
      panel.startRange(dragged[0], dragged[1])
    }

    anchor = null
    reach = null
  }

  const showPreview = (e: Event, event: CalendarEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()

    clearTimeout(previewTimer)
    previewTimer = setTimeout(() => {
      const below = box.bottom + PREVIEW_GAP + PREVIEW_HEIGHT <= window.innerHeight

      preview = {
        event,
        left: Math.max(
          PREVIEW_GAP,
          Math.min(box.left, window.innerWidth - PREVIEW_WIDTH - PREVIEW_GAP),
        ),
        top: below
          ? box.bottom + PREVIEW_GAP
          : Math.max(PREVIEW_GAP, box.top - PREVIEW_GAP - PREVIEW_HEIGHT),
      }
    }, PREVIEW_DELAY)
  }

  const hidePreview = () => {
    clearTimeout(previewTimer)
    preview = null
  }

  const noteLines = (notes: string) =>
    splitCitations(notes)
      .map(part => (typeof part === "string" ? part : part.title))
      .join("")
      .split("\n")
      .filter(line => line.trim() !== "")
      .slice(0, NOTE_LINES)

  const weekNumbers = $derived(panel.profile.calendar.showWeekNumbers)

  const weekdays = $derived(
    panel.weeks[0].map(d =>
      d.toLocaleDateString(currentLocale(), { weekday: "short" }),
    ),
  )

  const columns = $derived(
    weekNumbers ? "2rem repeat(7, minmax(0, 1fr))" : undefined,
  )

  const isoWeek = (day: Date) => {
    const at = new Date(
      Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()),
    )
    at.setUTCDate(at.getUTCDate() + 4 - (at.getUTCDay() || 7))
    const yearStart = Date.UTC(at.getUTCFullYear(), 0, 1)

    return Math.ceil(((at.getTime() - yearStart) / 86_400_000 + 1) / 7)
  }

  const onKey = (e: KeyboardEvent, day: Date) => {
    if (e.target !== e.currentTarget) {
      return
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      panel.pick(day)
    }
  }
</script>

<div class="grid grid-cols-7 gap-1" style:grid-template-columns={columns}>
  {#if weekNumbers}
    <div></div>
  {/if}
  {#each weekdays as weekday, index (weekday)}
    <div
      class={[
        "px-1 py-1.5 text-3xs font-medium",
        panel.weekdayTone(panel.weeks[0][index]) ?? "text-base-content/45",
      ]}
    >
      <span class="inline-flex min-w-5 justify-center">{weekday}</span>
    </div>
  {/each}
</div>

<svelte:window onpointerup={endDrag} onblur={endDrag} />

<div
  class="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1 select-none"
  style:grid-template-columns={columns}
>
  {#each panel.weeks as week (dateKey(week[0]))}
    {#if weekNumbers}
      <div class="flex justify-center p-1">
        <span
          class="flex h-5 items-center text-3xs tabular-nums text-base-content/50"
        >
          {isoWeek(week[0])}
        </span>
      </div>
    {/if}
    {#each week as day (dateKey(day))}
      {@const outside = day.getMonth() !== panel.month}
      {@const dayEvents = panel.eventsOn(day)}
      {@const holidays = panel.holidayFor(day)}
      {@const isToday = dateKey(day) === dateKey(panel.today)}
      {@const isSelected = dateKey(day) === dateKey(panel.selected)}
      {@const shown = dayEvents.length > CHIPS ? CHIPS - 1 : CHIPS}
      <div
        role="button"
        tabindex="0"
        aria-label={[longDay(day), ...holidays].join(", ")}
        aria-current={isToday ? "date" : undefined}
        aria-pressed={isSelected}
        class={[
          "flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden rounded-xl p-1",
          "text-left transition-colors duration-120",
          "focus-visible:outline-2 focus-visible:-outline-offset-2",
          "focus-visible:outline-primary",
          outside && "*:opacity-40",
          inRange(day) && "bg-primary/15",
          isSelected
            ? "bg-base-content/8"
            : !inRange(day) && "hover:bg-base-content/5",
        ]}
        onclick={() => panel.pick(day)}
        onkeydown={e => onKey(e, day)}
        onpointerdown={e => startDrag(e, day)}
        onpointerenter={() => extendDrag(day)}
      >
        <div class="flex min-w-0 items-center gap-1">
          <span
            class={[
              "grid size-6 shrink-0 place-items-center rounded-lg",
              "text-xs tabular-nums",
              isToday
                ? "bg-primary font-semibold text-primary-content"
                : ["font-medium", panel.dayTone(day)],
            ]}
          >
            {day.getDate()}
          </span>

          {#if holidays.length > 0}
            <span
              class={[
                "min-w-0 truncate text-3xs font-medium",
                panel.isHoliday(day) ? "text-error" : "text-base-content/50",
              ]}
              title={holidays.join(", ")}
            >
              {holidays.join(", ")}
            </span>
          {/if}
        </div>

        {#each dayEvents.slice(0, shown) as event (event.id + event.start)}
          {@const meta = colorMeta[toColor(event.color)]}
          {@const label = `${eventTime(event, $t("panel.allDay"))} ${event.title}`}
          <button
            type="button"
            class={[
              "flex h-4 w-full min-w-0 shrink-0 cursor-pointer items-center",
              "gap-1 rounded-sm px-1 text-left text-3xs text-base-content/85",
              "transition-colors duration-120 outline-none",
              "focus-visible:ring-2 focus-visible:ring-primary/50",
              event.allDay
                ? [meta.block, "font-medium"]
                : "hover:bg-base-content/8",
            ]}
            aria-label={label}
            onpointerenter={e => showPreview(e, event)}
            onpointerleave={hidePreview}
            onfocus={e => showPreview(e, event)}
            onblur={hidePreview}
            onclick={e => {
              e.stopPropagation()
              hidePreview()
              panel.show(event)
            }}
          >
            {#if !event.allDay}
              <span class={["size-1.5 shrink-0 rounded-full", meta.chip]}></span>
            {/if}
            <span class={["truncate", isDone(event) && "line-through opacity-60"]}>
              {event.title}
            </span>
          </button>
        {/each}

        {#if dayEvents.length > shown}
          <span
            class={[
              "flex h-4 shrink-0 items-center px-1",
              "text-3xs font-medium tabular-nums text-base-content/60",
            ]}
          >
            +{dayEvents.length - shown}
          </span>
        {/if}
      </div>
    {/each}
  {/each}
</div>

{#if preview}
  {@const meta = colorMeta[toColor(preview.event.color)]}
  {@const lines = noteLines(preview.event.notes)}

  <div
    role="tooltip"
    class={[
      "pointer-events-none fixed z-50 flex w-64 flex-col gap-1.5 rounded-box",
      "border border-base-content/10 bg-base-100 p-3 shadow-lg",
    ]}
    style:left="{preview.left}px"
    style:top="{preview.top}px"
  >
    <div class="flex min-w-0 items-center gap-2">
      <span class={["size-2 shrink-0 rounded-full", meta.chip]}></span>
      <span
        class={[
          "truncate text-sm font-semibold",
          isDone(preview.event) && "text-base-content/60 line-through",
        ]}
      >
        {preview.event.title}
      </span>
    </div>

    <div class="flex items-center gap-2 text-2xs tabular-nums text-base-content/65">
      <span>{eventSpan(preview.event, $t("panel.allDay"))}</span>

      {#if preview.event.recurrence !== "none"}
        <span class="flex items-center gap-1">
          <Icon icon="lucide:repeat" class="size-3" />
          {$t(`panel.event.recurrences.${preview.event.recurrence}`)}
        </span>
      {/if}
    </div>

    {#if lines.length > 0}
      <p class="border-t border-base-content/10 pt-1.5 text-xs leading-relaxed text-base-content/75">
        {#each lines as line, index (index)}
          <span class="block truncate">{line}</span>
        {/each}
      </p>
    {/if}
  </div>
{/if}
