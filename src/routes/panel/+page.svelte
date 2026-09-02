<script lang="ts">
  import Icon from "@iconify/svelte"
  import { emit, listen } from "@tauri-apps/api/event"
  import { getCurrentWindow } from "@tauri-apps/api/window"
  import {
    atMinutes,
    dateKey,
    dateTimeKey,
    parseLocal,
    startOfDay,
    upcoming,
  } from "$lib/data/calendar"
  import { live } from "$lib/data/live.svelte"
  import { blankNote } from "$lib/data/notes"
  import { events, newId, notes, todos } from "$lib/data/store"
  import { isOverdue } from "$lib/data/todo"
  import type { CalendarEvent } from "$lib/data/types"
  import { ensureDevice } from "$lib/device"
  import * as native from "$lib/native"
  import Agenda from "$lib/panel/Agenda.svelte"
  import Calendar from "$lib/panel/Calendar.svelte"
  import { dayLabel, longDate } from "$lib/panel/dates"
  import EventEditor from "$lib/panel/EventEditor.svelte"
  import Notes from "$lib/panel/Notes.svelte"
  import PanelSearch from "$lib/panel/PanelSearch.svelte"
  import QuickAdd from "$lib/panel/QuickAdd.svelte"
  import TodoItem from "$lib/panel/TodoItem.svelte"
  import TodoList from "$lib/panel/TodoList.svelte"
  import {
    defaultProfile,
    loadProfile,
    onProfile,
    type Profile,
  } from "$lib/settings"
  import Toasts from "$lib/settings-ui/Toasts.svelte"

  type Tab = "today" | "calendar" | "todo" | "notes"

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "today", label: "Today", icon: "lucide:sun" },
    { id: "calendar", label: "Calendar", icon: "lucide:calendar" },
    { id: "todo", label: "Todo", icon: "lucide:check-square" },
    { id: "notes", label: "Notes", icon: "lucide:notebook-pen" },
  ]

  const LOOKAHEAD_DAYS = 7
  const HOUR = 3_600_000
  const DEFAULT_MINUTES = 9 * 60
  const PICKER_TYPES = ["date", "datetime-local", "time", "color", "file"]

  const appWindow = getCurrentWindow()
  const todoLive = live(todos)
  const eventLive = live(events)

  let tab = $state<Tab>("today")
  let profile = $state<Profile>(defaultProfile)
  let now = $state(new Date())
  let selected = $state(startOfDay(new Date()))
  let editing = $state<{ event: CalendarEvent; isNew: boolean } | null>(null)
  let quickAdd = $state<ReturnType<typeof QuickAdd>>()
  let search = $state<ReturnType<typeof PanelSearch>>()
  let field = $state<HTMLInputElement>()
  let query = $state("")
  let openNoteId = $state<string | null>(null)

  const todayKey = $derived(dateKey(now))

  const searching = $derived(query.trim() !== "")

  const greeting = $derived(
    now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening",
  )

  const nextEvents = $derived(upcoming(eventLive.items, now, LOOKAHEAD_DAYS))

  const eventDays = $derived.by(() => {
    const groups = new Map<string, CalendarEvent[]>()

    for (const event of nextEvents) {
      const key = event.start.slice(0, 10)

      groups.set(key, [...(groups.get(key) ?? []), event])
    }

    return [...groups].map(([key, list]) => ({
      key,
      label: dayLabel(parseLocal(key), now),
      events: list,
    }))
  })

  const dueTodos = $derived(
    todoLive.items
      .filter(
        t =>
          !t.done &&
          t.due !== null &&
          (isOverdue(t, now) || t.due.slice(0, 10) === todayKey),
      )
      .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "")),
  )

  const summary = $derived.by(() => {
    const todayEvents = eventDays.find(d => d.key === todayKey)?.events ?? []
    const parts = [
      `${todayEvents.length} ${todayEvents.length === 1 ? "event" : "events"}`,
      `${dueTodos.length} ${dueTodos.length === 1 ? "todo" : "todos"} due`,
    ]

    return parts.join(" · ")
  })

  const isPicker = (el: Element | null) =>
    el instanceof HTMLSelectElement ||
    (el instanceof HTMLInputElement && PICKER_TYPES.includes(el.type))

  const hide = () => {
    editing = null
    emit("window-hidden", "panel")
    appWindow.hide()
  }

  const newEvent = (day: Date, minutes = DEFAULT_MINUTES) => {
    const stamp = Date.now()
    const start = atMinutes(startOfDay(day), minutes)

    editing = {
      isNew: true,
      event: {
        id: newId(),
        title: "",
        notes: "",
        start: dateTimeKey(start),
        end: dateTimeKey(new Date(start.getTime() + HOUR)),
        allDay: false,
        color: null,
        reminderMinutes: profile.calendar.reminderMinutes || null,
        recurrence: "none",
        createdAt: stamp,
        updatedAt: stamp,
      },
    }
  }

  const newNote = async () => {
    const note = await notes.put(blankNote())

    tab = "notes"
    query = ""
    openNoteId = note.id
  }

  const editEvent = async (occurrence: CalendarEvent) => {
    const original = await events.get(occurrence.id)

    editing = { isNew: false, event: original ?? occurrence }
  }

  const onTabKey = (e: KeyboardEvent) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0

    if (step === 0) {
      return
    }

    e.preventDefault()

    const index = TABS.findIndex(t => t.id === tab)
    const next = TABS[(index + step + TABS.length) % TABS.length]

    tab = next.id
    ;(e.currentTarget as HTMLElement)
      .querySelector<HTMLButtonElement>(`[data-tab="${next.id}"]`)
      ?.focus()
  }

  const typing = (target: EventTarget | null) =>
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement

  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      search?.openFirst()
    }
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "/" && !typing(e.target)) {
      e.preventDefault()
      field?.focus()
      field?.select()

      return
    }

    if (e.key !== "Escape") {
      return
    }

    if (editing) {
      editing = null

      return
    }

    if (query) {
      query = ""

      return
    }

    hide()
  }

  $effect(() => {
    ensureDevice().catch(() => undefined)
    loadProfile().then(p => {
      profile = p
    })

    const stops = [
      onProfile(p => {
        profile = p
      }),
      appWindow.onFocusChanged(({ payload: focused }) => {
        if (!focused && !isPicker(document.activeElement)) {
          hide()
        }
      }),
      listen("panel-new-note", () => {
        newNote()
      }),
      native.onWindowShown("panel", () => {
        now = new Date()
        selected = startOfDay(now)
        query = ""
        quickAdd?.focus()
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

      todoLive.stop()
      eventLive.stop()
    }
  })
</script>

<svelte:window {onkeydown} />

<main class="relative flex h-full flex-col">
  <header class="flex flex-col gap-3 px-5 pt-5 pb-3">
    <div class="flex items-start justify-between gap-3">
      <div class="flex flex-col">
        <span class="text-[11px] font-medium tracking-wide text-base-content/50">
          {now.getFullYear()}
        </span>

        <h1 class="text-lg font-semibold leading-tight">{longDate(now)}</h1>
      </div>

      <button
        class="btn btn-ghost btn-square btn-sm"
        aria-label="Close"
        onclick={hide}
      >
        <Icon icon="lucide:x" class="size-4" />
      </button>
    </div>

    <label
      class="input input-sm w-full rounded-full border-base-content/10 bg-base-100/60 transition-colors duration-150 focus-within:border-primary/50"
    >
      <Icon icon="lucide:search" class="size-4 shrink-0 text-base-content/50" />

      <input
        bind:this={field}
        bind:value={query}
        type="text"
        placeholder="Search todos and events"
        aria-label="Search todos and events"
        spellcheck="false"
        autocomplete="off"
        onkeydown={onSearchKey}
      />

      {#if searching}
        <button
          class="btn btn-ghost btn-circle btn-xs"
          aria-label="Clear search"
          onclick={() => {
            query = ""
          }}
        >
          <Icon icon="lucide:x" class="size-3.5" />
        </button>
      {:else}
        <kbd class="kbd kbd-xs">/</kbd>
      {/if}
    </label>

    <div
      class="tabs tabs-box tabs-sm w-full bg-base-100/50 p-1"
      role="tablist"
      aria-label="Panel"
      tabindex="-1"
      onkeydown={onTabKey}
    >
      {#each TABS as item (item.id)}
        <button
          class={["tab grow gap-1.5", tab === item.id && "tab-active"]}
          role="tab"
          data-tab={item.id}
          aria-selected={tab === item.id}
          aria-controls="panel-{item.id}"
          tabindex={tab === item.id ? 0 : -1}
          onclick={() => {
            tab = item.id
            query = ""
          }}
        >
          <Icon icon={item.icon} class="size-3.5" />

          {item.label}
        </button>
      {/each}
    </div>
  </header>

  <section
    id="panel-{tab}"
    class="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-4 pb-5"
    role="tabpanel"
  >
    {#if searching}
      <PanelSearch
        bind:this={search}
        events={eventLive.items}
        todos={todoLive.items}
        query={query.trim()}
        {now}
        onedit={editEvent}
      />
    {:else if tab === "today"}
      <div class="flex flex-col gap-0.5 px-1">
        <p class="text-base font-medium">{greeting}</p>

        <p class="text-xs text-base-content/55">{summary}</p>
      </div>

      <QuickAdd
        bind:this={quickAdd}
        defaultReminder={profile.calendar.reminderMinutes || null}
      />

      {#each eventDays as day (day.key)}
        <Agenda
          title={day.label}
          events={day.events}
          {now}
          onedit={editEvent}
        />
      {:else}
        <Agenda
          title="Next 7 days"
          events={[]}
          empty="No upcoming events"
          onedit={editEvent}
        />
      {/each}

      <section class="flex flex-col gap-1">
        <h3
          class="px-2 text-[11px] font-semibold tracking-wide text-base-content/50"
        >
          Due
        </h3>

        {#if dueTodos.length > 0}
          <ul class="flex flex-col gap-0.5">
            {#each dueTodos as todo (todo.id)}
              <TodoItem {todo} {now} />
            {/each}
          </ul>
        {:else}
          <p class="px-2 py-2 text-sm text-base-content/45">Nothing due</p>
        {/if}
      </section>
    {:else if tab === "calendar"}
      <Calendar
        events={eventLive.items}
        todos={todoLive.items}
        weekStartsOn={profile.calendar.weekStartsOn}
        showWeekNumbers={profile.calendar.showWeekNumbers}
        {now}
        bind:selected
        onadd={newEvent}
        onedit={editEvent}
      />
    {:else if tab === "todo"}
      <TodoList items={todoLive.items} {profile} {now} />
    {:else}
      <Notes openId={openNoteId} />
    {/if}
  </section>

  {#if editing}
    <EventEditor
      event={editing.event}
      isNew={editing.isNew}
      onclose={() => {
        editing = null
      }}
    />
  {/if}

  <Toasts />
</main>

<style>
  :global(.siri-aura) {
    mask-image: none;
  }
</style>
