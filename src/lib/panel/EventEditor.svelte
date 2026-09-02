<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import { dateKey } from "$lib/data/calendar"
  import { events } from "$lib/data/store"
  import type { CalendarEvent, Recurrence } from "$lib/data/types"
  import { rangeError } from "./dates"

  type Props = {
    event: CalendarEvent
    isNew: boolean
    onclose: () => void
  }

  let { event, isNew, onclose }: Props = $props()

  const COLORS: { value: string | null; label: string }[] = [
    { value: null, label: "Default" },
    { value: "var(--color-secondary)", label: "Secondary" },
    { value: "var(--color-accent)", label: "Accent" },
    { value: "var(--color-success)", label: "Success" },
    { value: "var(--color-warning)", label: "Warning" },
    { value: "var(--color-error)", label: "Error" },
  ]

  const REMINDERS: { value: number | null; label: string }[] = [
    { value: null, label: "None" },
    { value: 0, label: "At start" },
    { value: 5, label: "5 minutes before" },
    { value: 10, label: "10 minutes before" },
    { value: 15, label: "15 minutes before" },
    { value: 30, label: "30 minutes before" },
    { value: 60, label: "1 hour before" },
    { value: 1440, label: "1 day before" },
  ]

  const RECURRENCES: { value: Recurrence; label: string }[] = [
    { value: "none", label: "Does not repeat" },
    { value: "daily", label: "Daily" },
    { value: "weekdays", label: "Weekdays" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "yearly", label: "Yearly" },
  ]

  let draft = $state(untrack(() => ({ ...event })))
  let title = $state<HTMLInputElement>()

  $effect(() => {
    title?.focus()
  })

  const error = $derived(rangeError(draft.start, draft.end))

  const valid = $derived(draft.title.trim() !== "" && error === null)

  const setAllDay = (allDay: boolean) => {
    draft.allDay = allDay

    if (allDay) {
      draft.start = draft.start.slice(0, 10)
      draft.end = draft.end.slice(0, 10)
    } else {
      const day = draft.start.slice(0, 10) || dateKey(new Date())

      draft.start = `${day}T09:00`
      draft.end = `${day}T10:00`
    }
  }

  const fixEnd = () => {
    if (draft.end < draft.start) {
      draft.end = draft.start
    }
  }

  const save = async () => {
    if (!valid) {
      return
    }

    await events.put({ ...$state.snapshot(draft), title: draft.title.trim() })
    onclose()
  }

  const remove = async () => {
    await events.remove(draft.id)
    onclose()
  }

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation()
      onclose()
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      save()
    }
  }
</script>

<div
  class="absolute inset-0 z-20 flex flex-col bg-base-100/90 backdrop-blur-xl"
  role="dialog"
  aria-modal="true"
  aria-label={isNew ? "New event" : "Edit event"}
  tabindex="-1"
  {onkeydown}
>
  <header class="flex items-center justify-between px-5 pt-5 pb-3">
    <h2 class="text-base font-semibold">{isNew ? "New event" : "Edit event"}</h2>

    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label="Close"
      onclick={onclose}
    >
      <Icon icon="lucide:x" class="size-4" />
    </button>
  </header>

  <div class="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-5 pb-4">
    <input
      bind:this={title}
      bind:value={draft.title}
      type="text"
      class="input w-full text-base"
      placeholder="Title"
      aria-label="Title"
      spellcheck="false"
    />

    <label class="flex items-center justify-between gap-3 text-sm">
      <span>All day</span>

      <input
        type="checkbox"
        class="toggle toggle-primary toggle-sm"
        checked={draft.allDay}
        onchange={e => setAllDay(e.currentTarget.checked)}
      />
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-base-content/60">
        Start

        {#if draft.allDay}
          <input
            type="date"
            class="input input-sm w-full"
            bind:value={draft.start}
            onchange={fixEnd}
          />
        {:else}
          <input
            type="datetime-local"
            class="input input-sm w-full"
            bind:value={draft.start}
            onchange={fixEnd}
          />
        {/if}
      </label>

      <label class="flex flex-col gap-1 text-xs text-base-content/60">
        End

        {#if draft.allDay}
          <input
            type="date"
            class="input input-sm w-full"
            min={draft.start}
            bind:value={draft.end}
          />
        {:else}
          <input
            type="datetime-local"
            class="input input-sm w-full"
            min={draft.start}
            bind:value={draft.end}
          />
        {/if}
      </label>
    </div>

    {#if error}
      <p class="-mt-2 text-xs text-error" role="alert">{error}</p>
    {/if}

    <div class="flex flex-col gap-1.5 text-xs text-base-content/60">
      Color

      <div class="flex items-center gap-2" role="radiogroup" aria-label="Color">
        {#each COLORS as color (color.label)}
          <button
            class={[
              "size-6 rounded-full transition-transform duration-150 hover:scale-110",
              draft.color === color.value &&
                "ring-2 ring-base-content/80 ring-offset-2 ring-offset-base-100",
            ]}
            style:background={color.value ?? "var(--color-primary)"}
            role="radio"
            aria-checked={draft.color === color.value}
            aria-label={color.label}
            onclick={() => {
              draft.color = color.value
            }}
          ></button>
        {/each}
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-base-content/60">
        Reminder

        <select
          class="select select-sm w-full"
          bind:value={draft.reminderMinutes}
        >
          {#each REMINDERS as option (option.label)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>

      <label class="flex flex-col gap-1 text-xs text-base-content/60">
        Repeat

        <select class="select select-sm w-full" bind:value={draft.recurrence}>
          {#each RECURRENCES as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
    </div>

    <label class="flex flex-col gap-1 text-xs text-base-content/60">
      Notes

      <textarea
        class="textarea textarea-sm w-full"
        rows="3"
        bind:value={draft.notes}
        placeholder="Notes"
      ></textarea>
    </label>
  </div>

  <footer
    class="flex items-center gap-2 border-t border-base-content/10 px-5 py-3"
  >
    {#if !isNew}
      <button class="btn btn-ghost btn-sm text-error" onclick={remove}>
        <Icon icon="lucide:trash-2" class="size-4" />

        Delete
      </button>
    {/if}

    <span class="grow"></span>

    <button class="btn btn-ghost btn-sm" onclick={onclose}>Cancel</button>

    <button class="btn btn-primary btn-sm" disabled={!valid} onclick={save}>
      Save
    </button>
  </footer>
</div>
