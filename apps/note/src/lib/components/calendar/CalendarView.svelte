<script lang="ts">
  import Icon from "@iconify/svelte"
  import type { Attachment } from "svelte/attachments"
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

  const isThisMonth = $derived(
    cursor.getFullYear() === today.getFullYear() &&
      cursor.getMonth() === today.getMonth(),
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

  const SWIPE = 56

  // touch only: a sideways swipe on the month flips it, vertical drags still scroll
  const swipe: Attachment<HTMLElement> = node => {
    let pointer = -1
    let x = 0
    let y = 0

    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch") {
        pointer = e.pointerId
        x = e.clientX
        y = e.clientY
      }
    }

    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointer) {
        return
      }

      pointer = -1

      const dx = e.clientX - x
      const dy = e.clientY - y

      if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy) * 1.5) {
        shift(dx < 0 ? 1 : -1)
      }
    }

    const cancel = () => (pointer = -1)

    node.addEventListener("pointerdown", down)
    node.addEventListener("pointerup", up)
    node.addEventListener("pointercancel", cancel)

    return () => {
      node.removeEventListener("pointerdown", down)
      node.removeEventListener("pointerup", up)
      node.removeEventListener("pointercancel", cancel)
    }
  }
</script>

<!-- container queries can't style the container, so the layout lives one level down -->
<div class="@container relative flex min-h-0 flex-1 flex-col">
  <div
    class={[
      "flex min-h-0 flex-1 flex-col overflow-y-auto",
      "@4xl:flex-row @4xl:overflow-hidden",
    ]}
  >
    <div class="flex min-w-0 flex-col @4xl:flex-1 @4xl:overflow-y-auto">
      <header
        class={[
          "flex items-center justify-between gap-2 border-b border-base-content/10",
          "bg-base-100 px-4 py-2.5",
        ]}
      >
        <h2 class="flex items-baseline gap-2">
          <span class="tabular text-xl font-bold tracking-tight @4xl:text-lg">
            {cursor.getMonth() + 1}월
          </span>
          <span class="tabular text-sm text-base-content/50">
            {cursor.getFullYear()}
          </span>
        </h2>

        <div class="flex items-center gap-1">
          <button
            class="btn btn-sm btn-ghost btn-square"
            aria-label="이전 달"
            onclick={() => shift(-1)}
          >
            <Icon icon="lucide:chevron-left" class="size-4" />
          </button>

          <button
            class={["btn btn-sm btn-ghost px-2.5", isThisMonth && "text-primary"]}
            onclick={jumpToday}
          >
            오늘
          </button>

          <button
            class="btn btn-sm btn-ghost btn-square"
            aria-label="다음 달"
            onclick={() => shift(1)}
          >
            <Icon icon="lucide:chevron-right" class="size-4" />
          </button>

          <button class="btn btn-sm btn-primary ml-1 @max-2xl:hidden" onclick={startNew}>
            <Icon icon="lucide:plus" class="size-4" />
            새 일정
          </button>
        </div>
      </header>

      <div class="touch-pan-y" {@attach swipe}>
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
    </div>

    <aside
      class={[
        "flex shrink-0 flex-col border-t border-base-content/10 bg-base-100",
        "@4xl:min-h-0 @4xl:w-80 @4xl:border-t-0 @4xl:border-l",
        openId === null
          ? "@max-2xl:pb-20"
          : "@max-4xl:absolute @max-4xl:inset-0 @max-4xl:z-20 @max-4xl:border-t-0",
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
          {today}
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

  {#if openId === null}
    <button
      class={[
        "btn btn-primary btn-square absolute right-4 bottom-4 z-10 size-14",
        "shadow-lg shadow-black/40 @2xl:hidden",
      ]}
      aria-label="새 일정"
      onclick={startNew}
    >
      <Icon icon="lucide:plus" class="size-6" />
    </button>
  {/if}
</div>
