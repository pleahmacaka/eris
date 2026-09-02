<script lang="ts">
  import { untrack } from "svelte"
  import {
    addDays,
    dateKey,
    eventsOn,
    parseLocal,
    startOfDay,
  } from "$lib/data/calendar"
  import type { CalendarEvent } from "$lib/data/types"
  import { longDate } from "./dates"

  type Props = {
    events: CalendarEvent[]
    days: Date[]
    now: Date
    onadd: (day: Date, minutes?: number) => void
    onedit: (event: CalendarEvent) => void
  }

  let { events, days, now, onadd, onedit }: Props = $props()

  type Slot = {
    event: CalendarEvent
    from: number
    to: number
    lane: number
    lanes: number
  }

  const END_HOUR = 24
  const DEFAULT_START = 6
  const HOUR_PX = 40
  const MIN_MINUTES = 20

  let scroller = $state<HTMLDivElement>()

  const minuteOf = (d: Date) => d.getHours() * 60 + d.getMinutes()

  const layout = (day: Date, list: CalendarEvent[]) => {
    const base = startOfDay(day).getTime()
    const close = addDays(startOfDay(day), 1).getTime()

    const slots: Slot[] = list
      .filter(event => !event.allDay)
      .map(event => {
        const start = parseLocal(event.start)
        const end = parseLocal(event.end)
        const from = start.getTime() <= base ? 0 : minuteOf(start)
        const to = end.getTime() >= close ? END_HOUR * 60 : minuteOf(end)

        return {
          event,
          from,
          to: Math.max(to, from + MIN_MINUTES),
          lane: 0,
          lanes: 1,
        }
      })
      .sort((a, b) => a.from - b.from || b.to - a.to)

    let group: Slot[] = []
    let ends: number[] = []

    const settle = () => {
      for (const slot of group) {
        slot.lanes = ends.length
      }

      group = []
      ends = []
    }

    for (const slot of slots) {
      if (ends.length > 0 && Math.max(...ends) <= slot.from) {
        settle()
      }

      const free = ends.findIndex(end => end <= slot.from)
      const lane = free < 0 ? ends.length : free

      ends[lane] = slot.to
      slot.lane = lane
      group.push(slot)
    }

    settle()

    return slots
  }

  const columns = $derived(
    days.map(day => {
      const list = eventsOn(events, day)

      return {
        day,
        key: dateKey(day),
        allDay: list.filter(event => event.allDay),
        slots: layout(day, list),
      }
    }),
  )

  const startHour = $derived.by(() => {
    const tops = columns.flatMap(column => column.slots.map(slot => slot.from))

    return Math.max(
      0,
      Math.min(DEFAULT_START, ...tops.map(top => Math.floor(top / 60))),
    )
  })

  const hours = $derived(
    Array.from({ length: END_HOUR - startHour }, (_, i) => startHour + i),
  )

  const todayKey = $derived(dateKey(now))

  const nowTop = $derived(
    (now.getHours() * 60 + now.getMinutes() - startHour * 60) * (HOUR_PX / 60),
  )

  const hasAllDay = $derived(columns.some(column => column.allDay.length > 0))

  const topOf = (minutes: number) => (minutes - startHour * 60) * (HOUR_PX / 60)

  const hourLabel = (hour: number) =>
    new Date(2024, 0, 1, hour).toLocaleTimeString("en-US", { hour: "numeric" })

  const slotLabel = (day: Date, hour: number) =>
    `New event ${longDate(day)} ${hourLabel(hour)}`

  const timeOf = (event: CalendarEvent) =>
    parseLocal(event.start).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })

  $effect(() => {
    const box = scroller

    if (box) {
      untrack(() => {
        box.scrollTop = Math.max(0, nowTop - HOUR_PX)
      })
    }
  })
</script>

<div class="flex flex-col gap-2">
  <div class="grid grid-cols-[2.25rem_repeat(7,1fr)] gap-px">
    <span></span>

    {#each columns as column (column.key)}
      <div class="flex flex-col items-center pb-0.5">
        <span class="text-[10px] text-base-content/50">
          {column.day.toLocaleDateString("en-US", { weekday: "short" })}
        </span>

        <span
          class={[
            "text-sm tabular-nums",
            column.key === todayKey && "font-semibold text-primary",
          ]}
        >
          {column.day.getDate()}
        </span>
      </div>
    {/each}
  </div>

  {#if hasAllDay}
    <div class="grid grid-cols-[2.25rem_repeat(7,1fr)] gap-px">
      <span class="self-start text-[9px] text-base-content/45">All day</span>

      {#each columns as column (column.key)}
        <div class="flex flex-col gap-0.5">
          {#each column.allDay as event (`${event.id}@${event.start}`)}
            <button
              class="truncate rounded-sm px-1 text-left text-[10px] leading-4 text-base-content/90"
              style:background={`color-mix(in oklch, ${event.color ?? "var(--color-primary)"} 35%, transparent)`}
              title={event.title}
              onclick={() => onedit(event)}
            >
              {event.title}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <div
    bind:this={scroller}
    class="max-h-64 overflow-y-auto rounded-field border border-base-content/10"
  >
    <div
      class="grid grid-cols-[2.25rem_repeat(7,1fr)]"
      style:height="{hours.length * HOUR_PX}px"
    >
      <div class="relative">
        {#each hours as hour (hour)}
          <span
            class="absolute right-1 text-[9px] text-base-content/45 tabular-nums"
            style:top="{topOf(hour * 60) - 5}px"
          >
            {hourLabel(hour)}
          </span>
        {/each}
      </div>

      {#each columns as column (column.key)}
        <div class="relative border-l border-base-content/10">
          {#each hours as hour (hour)}
            <button
              class="absolute inset-x-0 border-t border-base-content/10 transition-colors duration-150 hover:bg-base-content/5"
              style:top="{topOf(hour * 60)}px"
              style:height="{HOUR_PX}px"
              aria-label={slotLabel(column.day, hour)}
              onclick={() => onadd(column.day, hour * 60)}
            ></button>
          {/each}

          {#each column.slots as slot (`${slot.event.id}@${slot.event.start}`)}
            <button
              class="absolute overflow-hidden rounded-sm px-1 text-left text-[10px] leading-3.5 ring-1 ring-base-100/40"
              style:top="{topOf(slot.from)}px"
              style:height="{(slot.to - slot.from) * (HOUR_PX / 60)}px"
              style:left="{(slot.lane / slot.lanes) * 100}%"
              style:width="{100 / slot.lanes}%"
              style:background={`color-mix(in oklch, ${slot.event.color ?? "var(--color-primary)"} 45%, transparent)`}
              title={slot.event.title}
              onclick={() => onedit(slot.event)}
            >
              <span class="block truncate font-medium">{slot.event.title}</span>

              <span class="block truncate text-base-content/70 tabular-nums">
                {timeOf(slot.event)}
              </span>
            </button>
          {/each}

          {#if column.key === todayKey && nowTop >= 0}
            <div
              class="pointer-events-none absolute inset-x-0 z-10 h-px bg-error"
              style:top="{nowTop}px"
            >
              <span
                class="absolute -top-[3px] -left-[3px] size-1.5 rounded-full bg-error"
              ></span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>
