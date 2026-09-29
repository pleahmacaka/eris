<script lang="ts">
  import Icon from "@iconify/svelte"
  import {
    dateKey,
    eventsOn,
    monthGrid,
    startOfDay,
  } from "$lib/data/calendar"
  import { live } from "$lib/data/live.svelte"
  import { events, todos } from "$lib/data/store"
  import type { CalendarEvent } from "$lib/data/types"
  import { device } from "$lib/settings.svelte"
  import DayPane from "./DayPane.svelte"
  import EventDetail from "./EventDetail.svelte"
  import MonthGrid from "./MonthGrid.svelte"

  const { openDay }: { openDay: (day: string) => void } = $props()

  const eventStore = live(events)
  const todoStore = live(todos)

  const today = startOfDay(new Date())

  let cursor = $state(startOfDay(new Date()))
  let selected = $state(startOfDay(new Date()))
  let openId = $state<string | null>(null)
  let editing = $state(false)

  const weekStart = $derived(
    device.value.appearance.weekStartsMonday ? (1 as const) : (0 as const),
  )

  const weeks = $derived(
    monthGrid(cursor.getFullYear(), cursor.getMonth(), weekStart),
  )

  const monthLabel = $derived(
    `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월`,
  )

  const eventsOnDay = (day: Date) => eventsOn(eventStore.items, day)

  const todosOn = (day: Date) =>
    todoStore.items.filter(t => (t.due ?? "").slice(0, 10) === dateKey(day))

  const todosOnDay = (day: Date) => todosOn(day).filter(t => !t.done).length

  const dayEvents = $derived(eventsOnDay(selected))

  const dayTodos = $derived(todosOn(selected))

  const openEvent = $derived(
    openId === null
      ? null
      : (dayEvents.find(e => e.id === openId) ??
        eventStore.items.find(e => e.id === openId) ??
        null),
  )

  const shift = (months: number) => {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + months, 1)
  }

  const jumpToday = () => {
    cursor = startOfDay(new Date())
    selected = startOfDay(new Date())
    openId = null
    editing = false
  }

  const pick = (day: Date) => {
    selected = day
    openId = null
    editing = false

    if (day.getMonth() !== cursor.getMonth()) {
      cursor = new Date(day.getFullYear(), day.getMonth(), 1)
    }
  }

  const show = (event: CalendarEvent) => {
    openId = event.id
    editing = false
  }

  const startNew = () => {
    openId = "new"
    editing = true
  }

  const close = () => {
    openId = null
    editing = false
  }
</script>

<div class="@container flex min-h-0 flex-1 flex-col overflow-y-auto">
<div class="flex flex-1 flex-col @4xl:min-h-0 @4xl:flex-row">
  <div class="flex min-w-0 flex-1 flex-col @4xl:overflow-y-auto">
    <header
      class={[
        "flex items-center justify-between gap-2 border-b border-base-content/10",
        "bg-base-100 px-4 py-2.5",
      ]}
    >
      <div>
        <h2 class="text-base font-bold tracking-tight">
          {monthLabel}
        </h2>
        <p class="tabular text-xs text-base-content/45">
          오늘 {dateKey(today)}
        </p>
      </div>

      <div class="flex items-center gap-1">
        <div class="join">
          <button
            class="join-item btn btn-sm btn-ghost btn-square"
            aria-label="이전 달"
            onclick={() => shift(-1)}
          >
            <Icon icon="lucide:chevron-left" class="size-4" />
          </button>

          <button class="join-item btn btn-sm btn-ghost" onclick={jumpToday}>
            오늘
          </button>

          <button
            class="join-item btn btn-sm btn-ghost btn-square"
            aria-label="다음 달"
            onclick={() => shift(1)}
          >
            <Icon icon="lucide:chevron-right" class="size-4" />
          </button>
        </div>

        <button class="btn btn-sm btn-primary" onclick={startNew}>
          <Icon icon="lucide:plus" class="size-4" />
          새 일정
        </button>
      </div>
    </header>

    <MonthGrid
      {weeks}
      month={cursor.getMonth()}
      {today}
      {selected}
      {eventsOnDay}
      {todosOnDay}
      {pick}
      openEvent={show}
    />
  </div>

  <aside
    class={[
      "flex min-h-72 shrink-0 flex-col border-base-content/10 bg-base-100",
      "border-t @4xl:min-h-0 @4xl:w-80 @4xl:border-l @4xl:border-t-0",
    ]}
  >
    {#if openId !== null}
      {#key openId}
        <EventDetail
          event={openEvent}
          day={selected}
          {editing}
          setEditing={value => (editing = value)}
          {close}
        />
      {/key}
    {:else}
      <DayPane
        day={selected}
        events={dayEvents}
        {dayTodos}
        openEvent={show}
        removeEvent={event => events.remove(event.id)}
        {startNew}
        openDay={() => openDay(dateKey(selected))}
      />
    {/if}
  </aside>
</div>
</div>
