<script lang="ts">
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import { dateKey } from "$lib/data"
  import type { CalendarEvent } from "$lib/data"
  import { colorMeta, toColor } from "./colors"
  import { eventTime } from "./format"

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

  const weekdays = $derived(
    weeks[0].map(d => ({
      label: d.toLocaleDateString(currentLocale(), { weekday: "short" }),
      day: d.getDay(),
    })),
  )

  const dayTone = (day: Date, holiday: boolean) => {
    if (holiday || day.getDay() === 0) {
      return "text-error"
    }

    return day.getDay() === 6 ? "text-info" : ""
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
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      pick(day)
    }
  }
</script>

<div
  class={[
    "grid grid-cols-7 border-b border-base-300 bg-base-200/40",
    "text-[0.625rem] font-medium tracking-wider text-base-content/55",
  ]}
  style:grid-template-columns={weekNumbers
    ? "2rem repeat(7, minmax(0, 1fr))"
    : undefined}
>
  {#if weekNumbers}
    <div></div>
  {/if}
  {#each weekdays as weekday (weekday.label)}
    <div
      class={[
        "px-2 py-1.5 text-center",
        weekday.day === 0 && "text-error",
        weekday.day === 6 && "text-info",
      ]}
    >
      {weekday.label}
    </div>
  {/each}
</div>

<div
  class="grid min-h-0 flex-1 grid-cols-7 grid-rows-6"
  style:grid-template-columns={weekNumbers
    ? "2rem repeat(7, minmax(0, 1fr))"
    : undefined}
>
  {#each weeks as week (dateKey(week[0]))}
    {#if weekNumbers}
      <div
        class={[
          "flex items-center justify-center border-b border-r border-base-300/70",
          "bg-base-200/30 text-[0.625rem] tabular text-base-content/40",
        ]}
      >
        {isoWeek(week[0])}
      </div>
    {/if}
    {#each week as day (dateKey(day))}
      {@const outside = day.getMonth() !== month}
      {@const dayEvents = eventsOnDay(day)}
      {@const holidays = holidayFor(day)}
      {@const isToday = dateKey(day) === dateKey(today)}
      {@const isSelected = dateKey(day) === dateKey(selected)}
      <div
        role="button"
        tabindex="0"
        class={[
          "flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden",
          "border-b border-r border-base-300/70 p-1.5 text-left",
          "text-[0.6875rem] transition-colors hover:bg-base-content/5",
          outside && "bg-base-200/30 text-base-content/30",
          isToday && !isSelected && "bg-primary/5",
          isSelected && "bg-primary/10 ring-1 ring-inset ring-primary",
        ]}
        onclick={() => pick(day)}
        onkeydown={e => onKey(e, day)}
      >
        <div class="flex items-center justify-between">
          <span
            class={[
              "tabular font-medium",
              isToday && "text-primary",
              !isToday && dayTone(day, holidays.length > 0),
            ]}
          >
            {day.getDate()}
          </span>

          {#if dayEvents.length > 0}
            <span class="tabular text-[0.5625rem] text-base-content/50">
              {dayEvents.length}
            </span>
          {/if}
        </div>

        {#each holidays as name (name)}
          <span
            class="mt-0.5 block truncate px-1.5 py-0.5 text-left text-[0.625rem] text-error/80"
            title={name}
          >
            {name}
          </span>
        {/each}

        {#each dayEvents.slice(0, 3) as event (event.id + event.start)}
          <button
            type="button"
            class={[
              "mt-0.5 block w-full cursor-pointer truncate rounded px-1.5",
              "py-0.5 text-left text-[0.625rem]",
              colorMeta[toColor(event.color)].block,
            ]}
            title="{eventTime(event, $t('panel.allDay'))} {event.title}"
            onclick={e => {
              e.stopPropagation()
              openEvent(event)
            }}
          >
            <span class="tabular font-medium"
              >{eventTime(event, $t("panel.allDay"))}</span
            >
            {event.title}
          </button>
        {/each}

        {#if dayEvents.length > 3}
          <span class="mt-0.5 px-1.5 text-[0.5625rem] text-base-content/45">
            +{dayEvents.length - 3}
          </span>
        {/if}
      </div>
    {/each}
  {/each}
</div>
