<script lang="ts">
  import Icon from "@iconify/svelte"
  import { formatRange, parseLocal, parseQuickEvent } from "$lib/data/calendar"
  import { events, newId, todos } from "$lib/data/store"
  import { dueLabel, parseQuickAdd } from "$lib/data/todo"
  import type { CalendarEvent, Todo } from "$lib/data/types"
  import { dayLabel } from "./dates"

  type Props = {
    mode?: "auto" | "todo"
    placeholder?: string
    defaultReminder?: number | null
  }

  let { mode = "auto", placeholder, defaultReminder = null }: Props = $props()

  let text = $state("")
  let input = $state<HTMLInputElement>()

  export const focus = () => input?.focus()

  const PRIORITY_TONE: Record<number, string> = {
    1: "badge-error",
    2: "badge-warning",
    3: "badge-info",
  }

  const hint = $derived(
    placeholder ?? (mode === "todo" ? "Add a todo" : "Add a todo, / for an event"),
  )

  const eventBody = (value: string) => {
    if (value.startsWith("/")) {
      return value.slice(1)
    }

    if (value.toLowerCase().startsWith("event ")) {
      return value.slice(6)
    }

    return null
  }

  const todoFrom = (parsed: Partial<Todo>): Todo => {
    const now = Date.now()

    return {
      id: newId(),
      title: "",
      notes: "",
      done: false,
      doneAt: null,
      priority: 0,
      due: null,
      tags: [],
      order: now,
      createdAt: now,
      updatedAt: now,
      ...parsed,
    }
  }

  const eventFrom = (parsed: Partial<CalendarEvent>): CalendarEvent => {
    const now = Date.now()

    return {
      id: newId(),
      title: "",
      notes: "",
      start: "",
      end: "",
      allDay: true,
      color: null,
      reminderMinutes: defaultReminder,
      recurrence: "none",
      createdAt: now,
      updatedAt: now,
      ...parsed,
    }
  }

  type Draft =
    | { kind: "event"; event: CalendarEvent }
    | { kind: "todo"; todo: Todo }

  const draft = $derived.by((): Draft | null => {
    const raw = text.trim()

    if (!raw) {
      return null
    }

    const body = mode === "auto" ? eventBody(raw) : null

    if (body !== null) {
      const event = eventFrom(parseQuickEvent(body))

      return event.title ? { kind: "event", event } : null
    }

    const todo = todoFrom(parseQuickAdd(raw))

    return todo.title ? { kind: "todo", todo } : null
  })

  const submit = async () => {
    if (!draft) {
      return
    }

    if (draft.kind === "event") {
      await events.put(draft.event)
    } else {
      await todos.put(draft.todo)
    }

    text = ""
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      submit()
    } else if (e.key === "Escape" && text) {
      e.stopPropagation()
      text = ""
    }
  }
</script>

<div class="flex flex-col gap-1.5">
  <label
    class="input input-sm w-full rounded-full border-base-content/10 bg-base-100/60 transition-colors duration-150 focus-within:border-primary/50"
  >
    <Icon icon="lucide:plus" class="size-4 shrink-0 text-base-content/50" />

    <input
      bind:this={input}
      bind:value={text}
      type="text"
      placeholder={hint}
      spellcheck="false"
      autocomplete="off"
      aria-label={hint}
      {onkeydown}
    />

    {#if text}
      <kbd class="kbd kbd-xs">Enter</kbd>
    {/if}
  </label>

  {#if draft}
    <div
      class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-3 text-xs text-base-content/60"
    >
      {#if draft.kind === "event"}
        <span class="badge badge-xs badge-soft badge-secondary">Event</span>

        <span class="truncate font-medium text-base-content/85">
          {draft.event.title}
        </span>

        <span>
          {dayLabel(parseLocal(draft.event.start))} · {formatRange(draft.event)}
        </span>
      {:else}
        <span class="badge badge-xs badge-soft badge-primary">Todo</span>

        <span class="truncate font-medium text-base-content/85">
          {draft.todo.title}
        </span>

        {#if draft.todo.due}
          <span>{dueLabel(draft.todo)}</span>
        {/if}

        {#if draft.todo.priority}
          <span class={["badge badge-xs badge-soft", PRIORITY_TONE[draft.todo.priority]]}>
            !{draft.todo.priority}
          </span>
        {/if}

        {#each draft.todo.tags as tag (tag)}
          <span class="badge badge-ghost badge-xs">#{tag}</span>
        {/each}
      {/if}
    </div>
  {/if}
</div>
