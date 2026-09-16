<script lang="ts">
  import Icon from "@iconify/svelte"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import { t } from "svelte-i18n"
  import {
    dateKey,
    events,
    eventsOn,
    live,
    monthGrid,
    startOfDay,
    todos,
    type CalendarEvent,
  } from "$lib/data"
  import { currentLocale } from "@eris/i18n"
  import { ensureDevice } from "$lib/device"
  import * as native from "$lib/native"
  import { DayPane, EventDetail, MonthGrid, TodoPane } from "$lib/panel"
  import { holidaysOn, systemRegion } from "$lib/panel/holidays"
  import {
    type DeviceSettings,
    defaultDevice,
    defaultProfile,
    loadDevice,
    loadProfile,
    onDevice,
    onProfile,
    type Profile,
  } from "@eris/settings"

  const PICKER_TYPES = ["date", "datetime-local", "time", "color", "file"]

  const appWindow = getCurrentWindow()
  const eventLive = live(events)
  const todoLive = live(todos)

  let profile = $state<Profile>(defaultProfile)
  let device = $state<DeviceSettings>(defaultDevice)
  let now = $state(new Date())
  let cursor = $state(startOfDay(new Date()))
  let selected = $state(startOfDay(new Date()))
  let openId = $state<string | null>(null)
  let editing = $state(false)
  let mode = $state<"day" | "todo">("day")

  const today = $derived(startOfDay(now))

  const weeks = $derived(
    monthGrid(
      cursor.getFullYear(),
      cursor.getMonth(),
      profile.calendar.weekStartsOn,
    ),
  )

  const monthLabel = $derived(
    cursor.toLocaleDateString(currentLocale(), {
      year: "numeric",
      month: "long",
    }),
  )

  const calendarOn = $derived(device.features.calendar)

  const dateLabel = $derived(
    today.toLocaleDateString(currentLocale(), {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }),
  )

  const dayEvents = $derived(eventsOn(eventLive.items, selected))

  const region = $derived(
    profile.calendar.region === "system"
      ? systemRegion()
      : profile.calendar.region,
  )

  const holidayFor = (day: Date) =>
    holidaysOn(day, region, currentLocale().split("-")[0])

  const openEvent = $derived(
    openId === null
      ? null
      : (eventLive.items.find(e => e.id === openId) ?? null),
  )

  const shift = (months: number) => {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + months, 1)
  }

  const jumpToday = () => {
    cursor = startOfDay(now)
    selected = startOfDay(now)
    openId = null
    editing = false
    mode = "day"
  }

  const pick = (day: Date) => {
    selected = day
    openId = null
    editing = false
    mode = "day"

    if (day.getMonth() !== cursor.getMonth()) {
      cursor = new Date(day.getFullYear(), day.getMonth(), 1)
    }
  }

  const show = (event: CalendarEvent) => {
    openId = event.id
    editing = false
    mode = "day"
  }

  const startNew = () => {
    openId = "new"
    editing = true
    mode = "day"
  }

  const showTodos = () => {
    openId = null
    editing = false
    mode = "todo"
  }

  const close = () => {
    openId = null
    editing = false
  }

  let focusLanded = false
  let shownAt = 0

  const BLUR_GRACE = 400

  const isPicker = (el: Element | null) =>
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLInputElement && PICKER_TYPES.includes(el.type))

  const hide = () => {
    focusLanded = false
    close()
    native.hideWindow("panel")
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key !== "Escape") {
      return
    }

    if (openId !== null) {
      close()

      return
    }

    hide()
  }

  $effect(() => {
    ensureDevice()
      .then(d => {
        device = d
      })
      .catch(() => undefined)
    native.takeIntent("panel").catch(() => undefined)
    loadProfile().then(p => {
      profile = p
    })

    const stops = [
      onProfile(p => {
        profile = p
      }),
      onDevice(d => {
        device = d
      }),
      appWindow.onFocusChanged(({ payload: focused }) => {
        if (focused) {
          if (!focusLanded) {
            focusLanded = true
            shownAt = Date.now()
          }

          return
        }

        const settling = Date.now() - shownAt < BLUR_GRACE

        if (focusLanded && !settling && !isPicker(document.activeElement)) {
          hide()
        }
      }),
      native.onWindowShown("panel", () => {
        focusLanded = false
        shownAt = Date.now()
        now = new Date()
        jumpToday()
      }),
    ]

    const tick = setInterval(() => {
      now = new Date()
    }, 60_000)

    return () => {
      clearInterval(tick)

      for (const stop of stops) {
        stop.then(fn => fn())
      }

      eventLive.stop()
      todoLive.stop()
    }
  })
</script>

<svelte:window {onkeydown} />

{#if !calendarOn}
  <main class="flex h-full min-h-0 flex-col">
    <header class="flex items-center justify-end px-3 py-2">
      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("common.close")}
        onclick={hide}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    </header>

    <div class="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 pb-4">
      <p class="text-2xl font-semibold tracking-tight">{dateLabel}</p>
      <p class="tabular text-sm text-base-content/50">{dateKey(today)}</p>
    </div>
  </main>
{:else}
<main class="flex h-full min-h-0 flex-col">
  <header
    class="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-2.5"
  >
    <div>
      <h2 class="text-[0.9375rem] font-semibold tracking-tight">
        {monthLabel}
      </h2>
      <p class="tabular text-[0.6875rem] text-base-content/45">
        {$t("panel.header.today", { values: { date: dateKey(today) } })}
      </p>
    </div>

    <div class="flex items-center gap-1">
      <div class="join">
        <button
          class="join-item btn btn-xs btn-ghost"
          aria-label={$t("common.previous")}
          onclick={() => shift(-1)}
        >
          <Icon icon="lucide:chevron-left" class="size-3" />
        </button>

        <button class="join-item btn btn-xs btn-ghost" onclick={jumpToday}>
          {$t("dates.today")}
        </button>

        <button
          class="join-item btn btn-xs btn-ghost"
          aria-label={$t("common.next")}
          onclick={() => shift(1)}
        >
          <Icon icon="lucide:chevron-right" class="size-3" />
        </button>
      </div>

      <button class="btn btn-xs btn-neutral" onclick={startNew}>
        <Icon icon="lucide:plus" class="size-3" />
        {$t("panel.event.new")}
      </button>

      <button class="btn btn-xs btn-ghost" onclick={showTodos}>
        <Icon icon="lucide:list-checks" class="size-3" />
        {$t("panel.todos")}
      </button>

      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("common.close")}
        onclick={hide}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    </div>
  </header>

  <div class="flex min-h-0 flex-1">
    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <MonthGrid
        {weeks}
        month={cursor.getMonth()}
        {today}
        {selected}
        eventsOnDay={day => eventsOn(eventLive.items, day)}
        {holidayFor}
        {pick}
        openEvent={show}
        weekNumbers={profile.calendar.showWeekNumbers}
      />
    </div>

    <aside
      class="flex h-auto w-[22rem] min-h-0 shrink-0 flex-col overflow-hidden border-l border-base-300 bg-base-100"
    >
      {#if mode === "todo"}
        <TodoPane
          items={todoLive.items}
          sortBy={profile.todo.sortBy}
          showCompleted={profile.todo.showCompleted}
          back={() => (mode = "day")}
        />
      {:else if openId !== null}
        {#key openId}
          <EventDetail
            event={openEvent}
            day={selected}
            {editing}
            setEditing={value => (editing = value)}
            {close}
            defaultReminder={profile.calendar.reminderMinutes || null}
          />
        {/key}
      {:else}
        <DayPane
          day={selected}
          events={dayEvents}
          holidays={holidayFor(selected)}
          openEvent={show}
          removeEvent={event => events.remove(event.id)}
          {startNew}
        />
      {/if}
    </aside>
  </div>
</main>
{/if}

<style>
  :global(.siri-aura) {
    mask-image: none;
  }
</style>
