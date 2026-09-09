<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import { t } from "svelte-i18n"
  import {
    dateKey,
    events,
    type CalendarEvent,
    type Recurrence,
  } from "$lib/data"
  import { rangeError } from "./dates"

  type Props = {
    event: CalendarEvent
    isNew: boolean
    onclose: () => void
  }

  let { event, isNew, onclose }: Props = $props()

  const COLORS: { value: string | null; id: string }[] = [
    { value: null, id: "default" },
    { value: "var(--color-secondary)", id: "secondary" },
    { value: "var(--color-accent)", id: "accent" },
    { value: "var(--color-success)", id: "success" },
    { value: "var(--color-warning)", id: "warning" },
    { value: "var(--color-error)", id: "error" },
  ]

  const REMINDERS: (number | null)[] = [null, 0, 5, 10, 15, 30, 60, 1440]

  const RECURRENCES: Recurrence[] = [
    "none",
    "daily",
    "weekdays",
    "weekly",
    "monthly",
    "yearly",
  ]

  const reminderLabel = (minutes: number | null) => {
    if (minutes === null) {
      return $t("common.none")
    }

    if (minutes === 0) {
      return $t("panel.event.reminders.atStart")
    }

    if (minutes === 60) {
      return $t("panel.event.reminders.hourBefore")
    }

    if (minutes === 1440) {
      return $t("panel.event.reminders.dayBefore")
    }

    return $t("panel.event.reminders.minutesBefore", {
      values: { count: minutes },
    })
  }

  const heading = $derived(
    isNew ? $t("panel.event.new") : $t("panel.event.edit"),
  )

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
  aria-label={heading}
  tabindex="-1"
  {onkeydown}
>
  <header class="flex items-center justify-between px-5 pt-5 pb-3">
    <h2 class="text-base font-semibold">{heading}</h2>

    <button
      class="btn btn-ghost btn-square btn-sm"
      aria-label={$t("common.close")}
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
      placeholder={$t("panel.title")}
      aria-label={$t("panel.title")}
      spellcheck="false"
    />

    <label class="flex items-center justify-between gap-3 text-sm">
      <span>{$t("panel.allDay")}</span>

      <input
        type="checkbox"
        class="toggle toggle-primary toggle-sm"
        checked={draft.allDay}
        onchange={e => setAllDay(e.currentTarget.checked)}
      />
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-base-content/60">
        {$t("panel.event.start")}

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
        {$t("panel.event.end")}

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
      {$t("panel.event.color")}

      <div class="flex items-center gap-2" role="radiogroup" aria-label={$t("panel.event.color")}>
        {#each COLORS as color (color.id)}
          <button
            class={[
              "size-6 rounded-full transition-transform duration-150 hover:scale-110",
              draft.color === color.value &&
                "ring-2 ring-base-content/80 ring-offset-2 ring-offset-base-100",
            ]}
            style:background={color.value ?? "var(--color-primary)"}
            role="radio"
            aria-checked={draft.color === color.value}
            aria-label={$t(`panel.colors.${color.id}`)}
            onclick={() => {
              draft.color = color.value
            }}
          ></button>
        {/each}
      </div>
    </div>

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1 text-xs text-base-content/60">
        {$t("panel.event.reminder")}

        <select
          class="select select-sm w-full"
          bind:value={draft.reminderMinutes}
        >
          {#each REMINDERS as minutes (minutes)}
            <option value={minutes}>{reminderLabel(minutes)}</option>
          {/each}
        </select>
      </label>

      <label class="flex flex-col gap-1 text-xs text-base-content/60">
        {$t("panel.event.repeat")}

        <select class="select select-sm w-full" bind:value={draft.recurrence}>
          {#each RECURRENCES as value (value)}
            <option {value}>{$t(`panel.event.recurrences.${value}`)}</option>
          {/each}
        </select>
      </label>
    </div>

    <label class="flex flex-col gap-1 text-xs text-base-content/60">
      {$t("panel.event.notes")}

      <textarea
        class="textarea textarea-sm w-full"
        rows="3"
        bind:value={draft.notes}
        placeholder={$t("panel.event.notes")}
      ></textarea>
    </label>
  </div>

  <footer
    class="flex items-center gap-2 border-t border-base-content/10 px-5 py-3"
  >
    {#if !isNew}
      <button class="btn btn-ghost btn-sm text-error" onclick={remove}>
        <Icon icon="lucide:trash-2" class="size-4" />

        {$t("common.delete")}
      </button>
    {/if}

    <span class="grow"></span>

    <button class="btn btn-ghost btn-sm" onclick={onclose}>{$t("common.cancel")}</button>

    <button class="btn btn-primary btn-sm" disabled={!valid} onclick={save}>
      {$t("common.save")}
    </button>
  </footer>
</div>
