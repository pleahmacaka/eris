<script lang="ts">
  import { dateKey } from "$lib/data/calendar"
  import type { CalendarEvent } from "$lib/data/types"
  import { colorMeta, toColor } from "./colors"
  import { eventTime } from "./format"

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

  const weekdays = $derived(
    weeks[0].map(d => d.toLocaleDateString("ko-KR", { weekday: "short" })),
  )

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
  {#each weekdays as label (label)}
    <div class="px-2 py-1.5 text-center">{label}</div>
  {/each}
</div>

<div class="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 bg-base-100">
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
        class={[
          "flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden",
          "border-b border-r border-base-content/10 p-1.5 text-left",
          "text-xs transition-colors hover:bg-base-content/5",
          outside && "bg-base-200/60 text-base-content/30",
          isToday && !isSelected && "bg-primary/5",
          isSelected && "bg-primary/10 ring-1 ring-inset ring-primary",
        ]}
        onclick={() => pick(day)}
        onkeydown={e => onKey(e, day)}
      >
        <div class="flex items-center justify-between">
          <span class={["tabular font-medium", isToday && "text-primary"]}>
            {day.getDate()}
          </span>

          {#if dayEvents.length + pending > 0}
            <span class="tabular text-2xs text-base-content/50">
              {dayEvents.length + pending}
            </span>
          {/if}
        </div>

        {#each dayEvents.slice(0, 3) as event (event.id + event.start)}
          <button
            type="button"
            class={[
              "mt-0.5 block w-full cursor-pointer truncate px-1.5",
              "py-0.5 text-left text-2xs",
              colorMeta[toColor(event.color)].block,
            ]}
            title="{eventTime(event)} {event.title}"
            onclick={e => {
              e.stopPropagation()
              openEvent(event)
            }}
          >
            <span class="tabular font-medium">{eventTime(event)}</span>
            {event.title}
          </button>
        {/each}

        {#if dayEvents.length > 3}
          <span class="mt-0.5 px-1.5 text-2xs text-base-content/45">
            +{dayEvents.length - 3}
          </span>
        {/if}
      </div>
    {/each}
  {/each}
</div>
