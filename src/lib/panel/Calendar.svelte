<script lang="ts">
  import Icon from "@iconify/svelte"
  import { load } from "@tauri-apps/plugin-store"
  import {
    addDays,
    dateKey,
    eventsOn,
    monthGrid,
    parseLocal,
    startOfDay,
    upcoming,
  } from "$lib/data/calendar"
  import type { CalendarEvent, Todo } from "$lib/data/types"
  import Segmented from "$lib/settings-ui/Segmented.svelte"
  import Agenda from "./Agenda.svelte"
  import { dayLabel, longDate } from "./dates"
  import IcsMenu from "./IcsMenu.svelte"
  import WeekView from "./WeekView.svelte"

  type Props = {
    events: CalendarEvent[]
    todos: Todo[]
    weekStartsOn: 0 | 1
    showWeekNumbers: boolean
    now: Date
    selected: Date
    onadd: (day: Date, minutes?: number) => void
    onedit: (event: CalendarEvent) => void
  }

  let {
    events,
    todos,
    weekStartsOn,
    showWeekNumbers,
    now,
    selected = $bindable(),
    onadd,
    onedit,
  }: Props = $props()

  type Mode = "month" | "week" | "agenda"

  const MAX_DOTS = 3
  const AGENDA_DAYS = 30
  const VIEW_FILE = "panel.json"
  const VIEW_KEY = "calendarView"

  const MODES: { value: Mode; label: string }[] = [
    { value: "month", label: "Month" },
    { value: "week", label: "Week" },
    { value: "agenda", label: "Agenda" },
  ]

  const ARROWS: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
  }

  let mode = $state<Mode>("month")

  let view = $derived({
    year: selected.getFullYear(),
    month: selected.getMonth(),
  })

  const todayKey = $derived(dateKey(now))

  const grid = $derived(monthGrid(view.year, view.month, weekStartsOn))

  const weekDays = $derived.by(() => {
    const offset = (selected.getDay() - weekStartsOn + 7) % 7
    const first = addDays(startOfDay(selected), -offset)

    return Array.from({ length: 7 }, (_, i) => addDays(first, i))
  })

  const agendaDays = $derived.by(() => {
    const groups = new Map<string, CalendarEvent[]>()

    for (const event of upcoming(events, startOfDay(selected), AGENDA_DAYS)) {
      const key = event.start.slice(0, 10)

      groups.set(key, [...(groups.get(key) ?? []), event])
    }

    return [...groups].map(([key, list]) => ({
      key,
      label: dayLabel(parseLocal(key), now),
      events: list,
    }))
  })

  const short = (day: Date) =>
    day.toLocaleDateString("en-US", { month: "short", day: "numeric" })

  const label = $derived.by(() => {
    if (mode === "month") {
      return new Date(view.year, view.month, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    }

    if (mode === "week") {
      return `${short(weekDays[0])} – ${short(weekDays[6])}`
    }

    return `From ${short(selected)}`
  })

  const onToday = $derived.by(() => {
    if (mode === "month") {
      return view.year === now.getFullYear() && view.month === now.getMonth()
    }

    if (mode === "week") {
      return weekDays.some(day => dateKey(day) === todayKey)
    }

    return dateKey(selected) === todayKey
  })

  const weekdays = $derived(
    Array.from({ length: 7 }, (_, i) =>
      new Date(2024, 0, 7 + ((i + weekStartsOn) % 7))
        .toLocaleDateString("en-US", { weekday: "short" })
        .slice(0, 2),
    ),
  )

  const eventsByDay = $derived(
    new Map(grid.flat().map(day => [dateKey(day), eventsOn(events, day)])),
  )

  const todosByDay = $derived.by(() => {
    const map = new Map<string, Todo[]>()

    for (const todo of todos) {
      if (todo.done || !todo.due) {
        continue
      }

      const key = todo.due.slice(0, 10)

      map.set(key, [...(map.get(key) ?? []), todo])
    }

    return map
  })

  const selectedKey = $derived(dateKey(selected))

  const selectedEvents = $derived(eventsByDay.get(selectedKey) ?? [])

  const selectedTodos = $derived(todosByDay.get(selectedKey) ?? [])

  const isoWeek = (day: Date) => {
    const date = new Date(
      Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()),
    )
    const weekday = date.getUTCDay() || 7

    date.setUTCDate(date.getUTCDate() + 4 - weekday)

    const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1)

    return Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7)
  }

  const show = (day: Date) => {
    view = { year: day.getFullYear(), month: day.getMonth() }
  }

  const select = (day: Date) => {
    selected = day
  }

  const shift = (direction: number) => {
    if (mode === "month") {
      show(new Date(view.year, view.month + direction, 1))

      return
    }

    select(addDays(selected, direction * (mode === "week" ? 7 : AGENDA_DAYS)))
  }

  const goToday = () => {
    select(startOfDay(now))
    show(now)
  }

  const setMode = (next: Mode) => {
    load(VIEW_FILE)
      .then(async store => {
        await store.set(VIEW_KEY, next)
        await store.save()
      })
      .catch(() => undefined)
  }

  const onkeydown = (e: KeyboardEvent) => {
    const step = ARROWS[e.key]

    if (step !== undefined) {
      e.preventDefault()
      select(addDays(selected, step))
    } else if (e.key === "Enter") {
      e.preventDefault()
      onadd(selected)
    }
  }

  $effect(() => {
    load(VIEW_FILE)
      .then(store => store.get<Mode>(VIEW_KEY))
      .then(saved => {
        if (saved && MODES.some(option => option.value === saved)) {
          mode = saved
        }
      })
      .catch(() => undefined)
  })
</script>

<div class="flex flex-col gap-3">
  <div class="flex items-center gap-1">
    <h2 class="grow truncate px-1 text-base font-semibold">{label}</h2>

    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="Previous"
      onclick={() => shift(-1)}
    >
      <Icon icon="lucide:chevron-left" class="size-4" />
    </button>

    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="Next"
      onclick={() => shift(1)}
    >
      <Icon icon="lucide:chevron-right" class="size-4" />
    </button>

    <button
      class="btn btn-primary btn-square btn-sm"
      aria-label="New event"
      title="New event"
      onclick={() => onadd(selected)}
    >
      <Icon icon="lucide:plus" class="size-4" />
    </button>

    <IcsMenu list={events} />
  </div>

  <div class="flex items-center gap-2">
    <Segmented
      bind:value={mode}
      options={MODES}
      label="Calendar view"
      onchange={setMode}
    />

    <span class="grow"></span>

    {#if !onToday}
      <button class="btn btn-soft btn-primary btn-xs rounded-full" onclick={goToday}>
        Today
      </button>
    {/if}
  </div>

  {#if mode === "month"}
    <div
      class={[
        "grid gap-y-0.5",
        showWeekNumbers ? "grid-cols-[1.5rem_repeat(7,1fr)]" : "grid-cols-7",
      ]}
      role="grid"
      aria-label="Month"
      tabindex="0"
      {onkeydown}
    >
      {#if showWeekNumbers}
        <span></span>
      {/if}

      {#each weekdays as name (name)}
        <span
          class="pb-1 text-center text-[11px] font-medium text-base-content/50"
        >
          {name}
        </span>
      {/each}

      {#each grid as week (dateKey(week[0]))}
        {#if showWeekNumbers}
          <span
            class="flex items-center justify-center text-[10px] text-base-content/40 tabular-nums"
          >
            {isoWeek(week[0])}
          </span>
        {/if}

        {#each week as day (dateKey(day))}
          {@const key = dateKey(day)}
          {@const dayEvents = eventsByDay.get(key) ?? []}
          {@const inMonth = day.getMonth() === view.month}
          {@const isSelected = key === selectedKey}
          <button
            class={[
              "relative flex h-11 flex-col items-center rounded-field pt-1 text-sm transition-colors duration-150 hover:bg-base-content/5",
              !inMonth && "text-base-content/35",
              key === todayKey && "font-semibold text-primary",
              isSelected && "bg-primary/15 ring-1 ring-primary/40",
            ]}
            role="gridcell"
            aria-selected={isSelected}
            aria-label={longDate(day)}
            tabindex="-1"
            onclick={() => select(day)}
            ondblclick={() => onadd(day)}
          >
            <span class="tabular-nums">{day.getDate()}</span>

            <span class="mt-1 flex h-1.5 items-center gap-0.5">
              {#each dayEvents.slice(0, MAX_DOTS) as event (`${event.id}@${event.start}`)}
                <span
                  class="size-1.5 rounded-full"
                  style:background={event.color ?? "var(--color-primary)"}
                ></span>
              {/each}

              {#if dayEvents.length > MAX_DOTS}
                <span class="text-[9px] leading-none text-base-content/60">
                  +{dayEvents.length - MAX_DOTS}
                </span>
              {/if}
            </span>

            {#if todosByDay.has(key)}
              <span
                class="absolute top-1 right-1 size-1 rounded-full bg-base-content/40"
              ></span>
            {/if}
          </button>
        {/each}
      {/each}
    </div>

    <Agenda
      title={longDate(selected)}
      events={selectedEvents}
      todos={selectedTodos}
      empty="Nothing scheduled"
      {now}
      {onedit}
    />
  {:else if mode === "week"}
    <WeekView {events} days={weekDays} {now} {onadd} {onedit} />
  {:else}
    {#each agendaDays as day (day.key)}
      <Agenda title={day.label} events={day.events} {now} {onedit} />
    {:else}
      <Agenda
        title="Next {AGENDA_DAYS} days"
        events={[]}
        empty="No upcoming events"
        {now}
        {onedit}
      />
    {/each}
  {/if}
</div>
