<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import {
    atMinutes,
    dateKey,
    dateTimeKey,
    events as eventStore,
    newId,
    parseLocal,
    startOfDay,
  } from "$lib/data"
  import type { CalendarEvent, Recurrence } from "$lib/data"
  import { colorMeta, eventColors, type EventColor, toColor } from "./colors"
  import { clock, eventSpan, longDay } from "./format"

  const {
    event,
    day,
    editing,
    setEditing,
    close,
    defaultReminder = null,
  }: {
    event: CalendarEvent | null
    day: Date
    editing: boolean
    setEditing: (value: boolean) => void
    close: () => void
    defaultReminder?: number | null
  } = $props()

  const RECURRENCES: Recurrence[] = [
    "none",
    "daily",
    "weekdays",
    "weekly",
    "monthly",
    "yearly",
  ]

  const REMINDERS: (number | null)[] = [null, 0, 5, 10, 15, 30, 60, 1440]

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

  const minutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number)

    return hour * 60 + minute
  }

  let title = $state("")
  let notes = $state("")
  let allDay = $state(false)
  let startTime = $state("10:00")
  let endTime = $state("11:00")
  let color = $state<EventColor>("primary")
  let recurrence = $state<Recurrence>("none")
  let reminder = $state<number | null>(null)

  const load = () => {
    title = event?.title ?? ""
    notes = event?.notes ?? ""
    allDay = event?.allDay ?? false
    startTime = event && !event.allDay ? clock(event.start) : "10:00"
    endTime = event && !event.allDay ? clock(event.end) : "11:00"
    color = toColor(event?.color ?? null)
    recurrence = event?.recurrence ?? "none"
    reminder = event?.reminderMinutes ?? defaultReminder
  }

  $effect(() => {
    if (editing) {
      load()
    }
  })

  const valid = $derived(
    title.trim() !== "" && (allDay || minutes(endTime) > minutes(startTime)),
  )

  const save = async () => {
    if (!valid) {
      return
    }

    const base = startOfDay(parseLocal(event?.start ?? dateKey(day)))
    const stamp = Date.now()
    const next: CalendarEvent = {
      id: event?.id ?? newId(),
      title: title.trim(),
      notes,
      allDay,
      start: allDay
        ? dateKey(base)
        : dateTimeKey(atMinutes(base, minutes(startTime))),
      end: allDay
        ? dateKey(base)
        : dateTimeKey(atMinutes(base, minutes(endTime))),
      color: color === "primary" ? null : `var(--color-${color})`,
      reminderMinutes: reminder,
      recurrence,
      createdAt: event?.createdAt ?? stamp,
      updatedAt: stamp,
    }

    await eventStore.put(next)
    setEditing(false)
    close()
  }

  const drop = async () => {
    if (event) {
      await eventStore.remove(event.id)
    }

    close()
  }
</script>

<div class="flex h-full min-h-0 flex-col">
  <header class="flex items-center gap-2 border-b border-base-300 px-4 py-3">
    <Icon icon="lucide:calendar-check" class="size-3.5 opacity-60" />
    <span class="flex-1 text-[0.6875rem] tracking-wider text-base-content/55">
      {editing ? $t("panel.event.edit") : $t("panel.event.detail")}
    </span>

    {#if event && !editing}
      <button
        class="btn btn-xs btn-ghost"
        aria-label={$t("panel.event.edit")}
        onclick={() => setEditing(true)}
      >
        <Icon icon="lucide:pencil" class="size-3" />
      </button>

      <button
        class="btn btn-xs btn-ghost text-error"
        aria-label={$t("common.delete")}
        onclick={drop}
      >
        <Icon icon="lucide:trash-2" class="size-3" />
      </button>
    {/if}

    <button
      class="btn btn-xs btn-ghost"
      aria-label={$t("common.close")}
      onclick={close}
    >
      <Icon icon="lucide:x" class="size-3" />
    </button>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
    {#if editing}
      <label class="block">
        <span
          class="text-[0.6875rem] font-medium tracking-wider text-base-content/55"
        >
          {$t("panel.title")}
        </span>
        <input
          class={[
            "mt-1 w-full border-0 border-b border-base-300 bg-transparent",
            "px-0 py-1.5 text-[1.0625rem] font-semibold outline-none",
            "focus:border-primary",
          ]}
          placeholder={$t("panel.event.new")}
          bind:value={title}
        />
      </label>

      <label class="mt-4 flex cursor-pointer items-center justify-between">
        <span class="text-[0.8125rem]">{$t("panel.allDay")}</span>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          bind:checked={allDay}
        />
      </label>

      {#if !allDay}
        <div class="mt-3 grid grid-cols-2 gap-3">
          <label class="block">
            <span
              class="text-[0.6875rem] font-medium tracking-wider text-base-content/55"
            >
              {$t("panel.event.start")}
            </span>
            <input
              type="time"
              class="input input-sm mt-1 w-full"
              bind:value={startTime}
            />
          </label>

          <label class="block">
            <span
              class="text-[0.6875rem] font-medium tracking-wider text-base-content/55"
            >
              {$t("panel.event.end")}
            </span>
            <input
              type="time"
              class="input input-sm mt-1 w-full"
              bind:value={endTime}
            />
          </label>
        </div>
      {/if}

      <div class="mt-3">
        <span
          class="text-[0.6875rem] font-medium tracking-wider text-base-content/55"
        >
          {$t("panel.event.color")}
        </span>
        <div class="mt-1.5 flex gap-1.5">
          {#each eventColors as option (option)}
            <button
              type="button"
              class={[
                "size-5 cursor-pointer rounded-full ring-2 ring-offset-2",
                "ring-offset-base-100",
                colorMeta[option].chip,
                color === option ? "ring-base-content" : "ring-transparent",
              ]}
              aria-label={$t(colorMeta[option].label)}
              onclick={() => (color = option)}
            ></button>
          {/each}
        </div>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3">
        <label class="block">
          <span
            class="text-[0.6875rem] font-medium tracking-wider text-base-content/55"
          >
            {$t("panel.event.repeat")}
          </span>
          <select class="select select-sm mt-1 w-full" bind:value={recurrence}>
            {#each RECURRENCES as option (option)}
              <option value={option}
                >{$t(`panel.event.recurrences.${option}`)}</option
              >
            {/each}
          </select>
        </label>

        <label class="block">
          <span
            class="text-[0.6875rem] font-medium tracking-wider text-base-content/55"
          >
            {$t("panel.event.reminder")}
          </span>
          <select class="select select-sm mt-1 w-full" bind:value={reminder}>
            {#each REMINDERS as option (option)}
              <option value={option}>{reminderLabel(option)}</option>
            {/each}
          </select>
        </label>
      </div>

      <label class="mt-4 block">
        <span
          class="text-[0.6875rem] font-medium tracking-wider text-base-content/55"
        >
          {$t("panel.event.notes")}
        </span>
        <textarea
          class="textarea textarea-bordered mt-1 w-full text-[0.8125rem]"
          rows="5"
          bind:value={notes}
        ></textarea>
      </label>

      <div class="mt-5 flex gap-2">
        <button class="btn btn-sm btn-ghost flex-1" onclick={close}
          >{$t("common.cancel")}</button
        >

        <button
          class="btn btn-sm btn-primary flex-1"
          disabled={!valid}
          onclick={save}
        >
          {$t("common.save")}
        </button>
      </div>
    {:else if event}
      {@const meta = colorMeta[toColor(event.color)]}
      <div class="flex items-center gap-2">
        <span class={["size-2.5 rounded-full", meta.chip]}></span>
        <span class="text-[0.6875rem] tracking-wider text-base-content/55">
          {$t(meta.label)}
        </span>
      </div>

      <h2 class="mt-2 text-xl font-semibold leading-tight">{event.title}</h2>

      <div class="mt-3 grid grid-cols-[5rem_1fr] gap-y-2 text-[0.8125rem]">
        <div class="text-base-content/55">{$t("panel.detail.date")}</div>
        <div>{longDay(parseLocal(event.start))}</div>

        <div class="text-base-content/55">{$t("panel.detail.time")}</div>
        <div class="tabular">{eventSpan(event, $t("panel.allDay"))}</div>

        <div class="text-base-content/55">{$t("panel.event.repeat")}</div>
        <div>{$t(`panel.event.recurrences.${event.recurrence}`)}</div>
      </div>

      <div class="mt-4 border-t border-base-300 pt-4">
        <div class="text-[0.6875rem] tracking-wider text-base-content/55">
          {$t("panel.event.notes")}
        </div>
        <p
          class="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-base-content/85"
        >
          {event.notes || $t("panel.event.noNotes")}
        </p>
      </div>
    {/if}
  </div>
</div>
