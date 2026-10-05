<script lang="ts">
  import { dateKey } from "$lib/data/calendar"
  import type { CalendarEvent } from "$lib/data/types"
  import { colorMeta, toColor } from "./colors"
  import { clock } from "./format"

  const {
    weeks,
    month,
    today,
    selected,
    eventsOnDay,
    todosOnDay,
    pick,
    openEvent,
  }: {
    weeks: Date[][]
    month: number
    today: Date
    selected: Date
    eventsOnDay: (day: Date) => CalendarEvent[]
    todosOnDay: (day: Date) => number
    pick: (day: Date) => void
    openEvent: (event: CalendarEvent) => void
  } = $props()

  const DOTS = 3

  const weekdays = $derived(
    weeks[0].map(d => ({
      label: d.toLocaleDateString("ko-KR", { weekday: "short" }),
      weekday: d.getDay(),
    })),
  )

  const tint = (weekday: number) =>
    weekday === 0 ? "text-error/80" : weekday === 6 ? "text-info/80" : ""

  const onKey = (e: KeyboardEvent, day: Date) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      pick(day)
    }
  }
</script>

<div
  class={[
    "grid grid-cols-7 border-b border-base-content/10 bg-base-100",
    "text-xs font-medium text-base-content/55",
  ]}
>
  {#each weekdays as { label, weekday } (label)}
    <div class={["py-1.5 text-center", tint(weekday)]}>{label}</div>
  {/each}
</div>

<div class="grid grid-cols-7 bg-base-100">
  {#each weeks as week (week[0].toISOString())}
    {#each week as day (day.toISOString())}
      {@const outside = day.getMonth() !== month}
      {@const dayEvents = eventsOnDay(day)}
      {@const pending = todosOnDay(day)}
      {@const isToday = dateKey(day) === dateKey(today)}
      {@const isSelected = dateKey(day) === dateKey(selected)}
      <div
        role="button"
        tabindex="0"
        aria-label={day.toLocaleDateString("ko-KR", {
          month: "long",
          day: "numeric",
        })}
        aria-pressed={isSelected}
        class={[
          "flex min-h-14 min-w-0 cursor-pointer flex-col items-center gap-1",
          "overflow-hidden border-b border-r border-base-content/10 p-1",
          "text-xs transition-colors hover:bg-base-content/5",
          "@2xl:min-h-20 @2xl:items-stretch @2xl:gap-0.5 @2xl:p-1.5",
          "@3xl:aspect-4/3 @3xl:min-h-0",
          outside && "bg-base-200/60 text-base-content/30",
          isToday && !isSelected && "@2xl:bg-primary/5",
          isSelected && "@2xl:bg-primary/10 @2xl:ring-1 @2xl:ring-inset @2xl:ring-primary",
        ]}
        onclick={() => pick(day)}
        onkeydown={e => onKey(e, day)}
      >
        <div class="flex items-center justify-between @2xl:w-full">
          <span
            class={[
              "tabular grid size-7 place-items-center font-medium @2xl:size-auto",
              !outside && tint(day.getDay()),
              isToday && "font-bold text-primary",
              isSelected &&
                "@max-2xl:bg-primary @max-2xl:text-primary-content",
              isToday && !isSelected && "@max-2xl:ring-1 @max-2xl:ring-primary",
            ]}
          >
            {day.getDate()}
          </span>

          {#if dayEvents.length + pending > 0}
            <span class="tabular hidden text-2xs text-base-content/50 @2xl:inline">
              {dayEvents.length + pending}
            </span>
          {/if}
        </div>

        <!-- narrow: a dot per event, the titles live in the agenda below -->
        {#if dayEvents.length + pending > 0}
          <div class="flex items-center gap-0.5 @2xl:hidden" aria-hidden="true">
            {#each dayEvents.slice(0, DOTS) as event (event.id + event.start)}
              <span class={["size-1.5", colorMeta[toColor(event.color)].chip]}
              ></span>
            {/each}
            {#if pending > 0 && dayEvents.length < DOTS}
              <span class="size-1.5 border border-base-content/50"></span>
            {/if}
            {#if dayEvents.length > DOTS}
              <span class="text-2xs leading-none text-base-content/50">+</span>
            {/if}
          </div>
        {/if}

        <!-- wide: title first, so a narrow cell cuts the time, not the title -->
        {#each dayEvents.slice(0, DOTS) as event (event.id + event.start)}
          {@const meta = colorMeta[toColor(event.color)]}
          <button
            type="button"
            class={[
              "mt-0.5 hidden w-full min-w-0 cursor-pointer items-center gap-1.5",
              "py-0.5 pr-1.5 text-left text-2xs @2xl:flex",
              meta.block,
            ]}
            title="{event.allDay ? '종일' : clock(event.start)} {event.title}"
            onclick={e => {
              e.stopPropagation()
              openEvent(event)
            }}
          >
            <span class={["w-0.5 self-stretch", meta.chip]}></span>
            <span class="min-w-0 flex-1 truncate font-medium">
              {event.title}
            </span>
            {#if !event.allDay}
              <span class="tabular hidden shrink-0 opacity-70 @5xl:inline">
                {clock(event.start)}
              </span>
            {/if}
          </button>
        {/each}

        {#if dayEvents.length > DOTS}
          <span class="mt-0.5 hidden px-1.5 text-2xs text-base-content/45 @2xl:block">
            +{dayEvents.length - DOTS}
          </span>
        {/if}
      </div>
    {/each}
  {/each}
</div>
