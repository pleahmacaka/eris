<script lang="ts">
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import { dateKey } from "$lib/data"
  import type { CalendarEvent } from "$lib/data"
  import { colorMeta, toColor } from "./colors"
  import { eventTime, longDay } from "./format"

  const {
    weeks,
    month,
    today,
    selected,
    eventsOnDay,
    holidayFor,
    pick,
    openEvent,
    weekNumbers = false,
  }: {
    weeks: Date[][]
    month: number
    today: Date
    selected: Date
    eventsOnDay: (day: Date) => CalendarEvent[]
    holidayFor: (day: Date) => string[]
    pick: (day: Date) => void
    openEvent: (event: CalendarEvent) => void
    weekNumbers?: boolean
  } = $props()

  const CHIPS = 3

  const weekdays = $derived(
    weeks[0].map(d => ({
      label: d.toLocaleDateString(currentLocale(), { weekday: "short" }),
      day: d.getDay(),
    })),
  )

  const columns = $derived(
    weekNumbers ? "2rem repeat(7, minmax(0, 1fr))" : undefined,
  )

  const dayTone = (day: number, holiday: boolean, rest: string) => {
    if (holiday || day === 0) {
      return "text-error"
    }

    return day === 6 ? "text-info" : rest
  }

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
      pick(day)
    }
  }
</script>

<div
  class="grid grid-cols-7 border-b border-base-300"
  style:grid-template-columns={columns}
>
  {#if weekNumbers}
    <div></div>
  {/if}
  {#each weekdays as weekday (weekday.label)}
    <div
      class={[
        "px-1 py-1.5 text-3xs font-medium",
        dayTone(weekday.day, false, "text-base-content/60"),
      ]}
    >
      <span class="inline-flex min-w-5 justify-center">{weekday.label}</span>
    </div>
  {/each}
</div>

<div
  class="grid min-h-0 flex-1 grid-cols-7 grid-rows-6"
  style:grid-template-columns={columns}
>
  {#each weeks as week, row (dateKey(week[0]))}
    {#if weekNumbers}
      <div
        class={[
          "flex justify-center border-base-300/70 bg-base-200/30 p-1",
          row > 0 && "border-t",
        ]}
      >
        <span
          class="flex h-5 items-center text-3xs tabular-nums text-base-content/50"
        >
          {isoWeek(week[0])}
        </span>
      </div>
    {/if}
    {#each week as day, column (dateKey(day))}
      {@const outside = day.getMonth() !== month}
      {@const dayEvents = eventsOnDay(day)}
      {@const holidays = holidayFor(day)}
      {@const isToday = dateKey(day) === dateKey(today)}
      {@const isSelected = dateKey(day) === dateKey(selected)}
      {@const shown = dayEvents.length > CHIPS ? CHIPS - 1 : CHIPS}
      <div
        role="button"
        tabindex="0"
        aria-label={[longDay(day), ...holidays].join(", ")}
        aria-current={isToday ? "date" : undefined}
        aria-pressed={isSelected}
        class={[
          "flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden p-1",
          "border-base-300/70 text-left transition-colors duration-120",
          "focus-visible:outline-2 focus-visible:-outline-offset-2",
          "focus-visible:outline-primary",
          row > 0 && "border-t",
          (column > 0 || weekNumbers) && "border-l",
          outside && "*:opacity-50",
          outside && !isSelected && "bg-base-200/40",
          isSelected
            ? "bg-primary/10 ring-1 ring-primary/50 ring-inset"
            : "hover:bg-base-content/5",
        ]}
        onclick={() => pick(day)}
        onkeydown={e => onKey(e, day)}
      >
        <div class="flex min-w-0 items-center gap-1">
          <span
            class={[
              "grid size-5 shrink-0 place-items-center rounded-full",
              "text-xs tabular-nums",
              isToday
                ? "bg-primary font-semibold text-primary-content"
                : [
                    "font-medium",
                    dayTone(day.getDay(), holidays.length > 0, ""),
                  ],
            ]}
          >
            {day.getDate()}
          </span>

          {#if holidays.length > 0}
            <span
              class="min-w-0 truncate text-3xs font-medium text-error"
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
            title={label}
            aria-label={label}
            onclick={e => {
              e.stopPropagation()
              openEvent(event)
            }}
          >
            {#if !event.allDay}
              <span class={["size-1.5 shrink-0 rounded-full", meta.chip]}></span>
            {/if}
            <span class="truncate">{event.title}</span>
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
