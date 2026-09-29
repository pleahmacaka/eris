<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import { t } from "svelte-i18n"
  import {
    addDays,
    atMinutes,
    dateKey,
    dateTimeKey,
    events as eventStore,
    newId,
    parseLocal,
    parseTimeToken,
    startOfDay,
    withoutToken,
  } from "$lib/data"
  import type { CalendarEvent, Recurrence } from "$lib/data"
  import { colorMeta, eventColors, type EventColor, toColor } from "./colors"
  import { eventSpan, longDay, shortDay } from "./format"
  import NoteText from "./NoteText.svelte"

  const {
    event,
    day,
    editing,
    setEditing,
    close,
    defaultReminder = null,
    span = 0,
  }: {
    event: CalendarEvent | null
    day: Date
    editing: boolean
    setEditing: (value: boolean) => void
    close: () => void
    defaultReminder?: number | null
    span?: number
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

  const DAY = 86_400_000
  const DAY_MINUTES = 1_440
  const DEFAULT_LENGTH = 60

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

  const inputTime = (value: string) => dateTimeKey(parseLocal(value)).slice(11)

  const minutes = (value: string) => {
    const [hour, minute] = value.split(":").map(Number)

    return hour * 60 + minute
  }

  const hhmm = (total: number) => {
    const wrapped = (total + DAY_MINUTES) % DAY_MINUTES

    return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`
  }

  let title = $state("")
  let notes = $state("")
  let allDay = $state(false)
  let startTime = $state("10:00")
  let endTime = $state("11:00")
  let color = $state<EventColor>("primary")
  let recurrence = $state<Recurrence>("none")
  let reminder = $state<number | null>(null)
  let appliedToken = -1
  let titleInput = $state<HTMLInputElement>()
  let titleMirror = $state<HTMLDivElement>()

  const token = $derived(parseTimeToken(title))

  const finalTitle = $derived(
    (token && !allDay ? withoutToken(title, token) : title).trim(),
  )

  const load = () => {
    title = event?.title ?? ""
    appliedToken = parseTimeToken(title)?.minutes ?? -1
    notes = event?.notes ?? ""
    allDay = event?.allDay ?? span > 0
    startTime = event && !event.allDay ? inputTime(event.start) : "10:00"
    endTime = event && !event.allDay ? inputTime(event.end) : "11:00"
    color = toColor(event?.color ?? null)
    recurrence = event?.recurrence ?? "none"
    reminder = event?.reminderMinutes ?? defaultReminder
  }

  $effect(() => {
    const at = token?.minutes ?? -1

    if (at === appliedToken) {
      return
    }

    appliedToken = at

    if (at < 0) {
      return
    }

    untrack(() => {
      const length =
        (minutes(endTime) - minutes(startTime) + DAY_MINUTES) % DAY_MINUTES ||
        DEFAULT_LENGTH

      startTime = hhmm(at)
      endTime = hhmm(at + length)
      allDay = false
    })
  })

  const syncMirror = () => {
    if (titleMirror && titleInput) {
      titleMirror.scrollLeft = titleInput.scrollLeft
    }
  }

  const eventId = $derived(event?.id)

  $effect(() => {
    void eventId

    if (editing) {
      untrack(load)
    }
  })

  const base = $derived(startOfDay(parseLocal(event?.start ?? dateKey(day))))

  const keptDays = $derived.by(() => {
    if (!event) {
      return span
    }

    const start = parseLocal(event.start)
    const end = parseLocal(event.end)

    if (!event.allDay && end.getTime() - start.getTime() < DAY) {
      return 0
    }

    return Math.max(
      0,
      Math.round((startOfDay(end).getTime() - base.getTime()) / DAY),
    )
  })

  const startAt = $derived(atMinutes(base, minutes(startTime)))

  const endAt = $derived.by(() => {
    const end = atMinutes(addDays(base, keptDays), minutes(endTime))

    return end < startAt ? addDays(end, 1) : end
  })

  const valid = $derived(finalTitle !== "" && (allDay || endAt > startAt))

  const save = async () => {
    if (!valid) {
      return
    }

    const stamp = Date.now()
    const next: CalendarEvent = {
      id: event?.id ?? newId(),
      title: finalTitle,
      notes,
      allDay,
      start: allDay ? dateKey(base) : dateTimeKey(startAt),
      end: allDay ? dateKey(addDays(base, keptDays)) : dateTimeKey(endAt),
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

{#snippet caption(text: string)}
  <span class="text-2xs font-medium text-base-content/60">{text}</span>
{/snippet}

<div class="flex h-full min-h-0 flex-col">
  <header
    class="flex min-h-14 items-center gap-2 border-b border-base-300 px-4 py-3"
  >
    <Icon
      icon="lucide:calendar-check"
      class="size-4 shrink-0 text-base-content/60"
    />
    <h2 class="flex-1 truncate text-sm font-semibold">
      {editing ? $t("panel.event.edit") : $t("panel.event.detail")}
    </h2>

    <div class="flex items-center gap-0.5">
      {#if event && !editing}
        <button
          class="btn btn-ghost btn-square btn-xs"
          aria-label={$t("panel.event.edit")}
          onclick={() => setEditing(true)}
        >
          <Icon icon="lucide:pencil" class="size-3.5" />
        </button>

        <button
          class="btn btn-ghost btn-square btn-xs text-error"
          aria-label={$t("common.delete")}
          onclick={drop}
        >
          <Icon icon="lucide:trash-2" class="size-3.5" />
        </button>
      {/if}

      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("common.close")}
        onclick={close}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    </div>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
    {#if editing}
      <div class="flex flex-col gap-4">
        <label class="flex flex-col gap-1">
          {@render caption($t("panel.title"))}
          <div class="relative">
            {#if token && !allDay}
              <div
                bind:this={titleMirror}
                aria-hidden="true"
                class={[
                  "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre",
                  "border-b border-transparent px-0 py-1.5 text-lg font-semibold",
                  "text-transparent",
                ]}
              >{title.slice(0, token.start)}<mark class="rounded-sm bg-primary/25 text-transparent">{title.slice(token.start, token.end)}</mark>{title.slice(token.end)}</div>
            {/if}

            <input
              bind:this={titleInput}
              class={[
                "relative w-full border-0 border-b border-base-300 bg-transparent px-0",
                "py-1.5 text-lg font-semibold outline-none",
                "transition-colors duration-120 focus:border-primary",
                "placeholder:text-base-content/35",
              ]}
              placeholder={$t("panel.event.new")}
              bind:value={title}
              onscroll={syncMirror}
              oninput={syncMirror}
            />
          </div>

          <span class="text-2xs tabular-nums text-base-content/60">
            {keptDays > 0
              ? `${shortDay(base)} – ${shortDay(addDays(base, keptDays))}`
              : shortDay(base)}
          </span>

          {#if token && !allDay}
            <span class="text-2xs text-primary">
              {$t("panel.event.timeFromTitle", { values: { time: hhmm(token.minutes) } })}
            </span>
          {/if}
        </label>

        <div class="flex flex-col gap-3">
          <label class="flex cursor-pointer items-center justify-between">
            <span class="text-sm">{$t("panel.allDay")}</span>
            <input
              type="checkbox"
              class="toggle toggle-primary toggle-sm"
              bind:checked={allDay}
            />
          </label>

          {#if !allDay}
            <div class="grid grid-cols-2 gap-3">
              <label class="flex flex-col gap-1">
                {@render caption($t("panel.event.start"))}
                <input
                  type="time"
                  class="input input-sm w-full tabular-nums"
                  bind:value={startTime}
                />
              </label>

              <label class="flex flex-col gap-1">
                {@render caption($t("panel.event.end"))}
                <input
                  type="time"
                  class="input input-sm w-full tabular-nums"
                  bind:value={endTime}
                />
              </label>
            </div>
          {/if}
        </div>

        <div class="flex flex-col gap-2">
          {@render caption($t("panel.event.color"))}
          <div class="flex gap-2 px-0.5">
            {#each eventColors as option (option)}
              <button
                type="button"
                class={[
                  "size-5 cursor-pointer rounded-full ring-2 ring-offset-2",
                  "ring-offset-base-100 transition-shadow duration-120",
                  "focus-visible:outline-2 focus-visible:outline-offset-6",
                  "focus-visible:outline-primary",
                  colorMeta[option].chip,
                  color === option
                    ? "ring-base-content/80"
                    : "ring-transparent hover:ring-base-content/25",
                ]}
                aria-label={$t(colorMeta[option].label)}
                aria-pressed={color === option}
                onclick={() => (color = option)}
              ></button>
            {/each}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1">
            {@render caption($t("panel.event.repeat"))}
            <select class="select select-sm w-full" bind:value={recurrence}>
              {#each RECURRENCES as option (option)}
                <option value={option}
                  >{$t(`panel.event.recurrences.${option}`)}</option
                >
              {/each}
            </select>
          </label>

          <label class="flex flex-col gap-1">
            {@render caption($t("panel.event.reminder"))}
            <select class="select select-sm w-full" bind:value={reminder}>
              {#each REMINDERS as option (option)}
                <option value={option}>{reminderLabel(option)}</option>
              {/each}
            </select>
          </label>
        </div>

        <label class="flex flex-col gap-1">
          {@render caption($t("panel.event.notes"))}
          <textarea class="textarea w-full text-sm" rows="5" bind:value={notes}
          ></textarea>
        </label>

        <div class="mt-1 flex gap-2">
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
      </div>
    {:else if event}
      {@const meta = colorMeta[toColor(event.color)]}
      <div class="flex items-start gap-2.5">
        <span class={["mt-2 size-2.5 shrink-0 rounded-full", meta.chip]}></span>
        <h3 class="text-xl leading-tight font-semibold break-words text-balance">
          {event.title}
        </h3>
      </div>

      <dl class="mt-5 flex flex-col gap-2.5 text-sm">
        <div class="flex gap-3">
          <dt class="w-20 shrink-0 text-base-content/60">
            {$t("panel.detail.date")}
          </dt>
          <dd class="min-w-0">{longDay(parseLocal(event.start))}</dd>
        </div>

        <div class="flex gap-3">
          <dt class="w-20 shrink-0 text-base-content/60">
            {$t("panel.detail.time")}
          </dt>
          <dd class="min-w-0 tabular-nums">
            {eventSpan(event, $t("panel.allDay"))}
          </dd>
        </div>

        <div class="flex gap-3">
          <dt class="w-20 shrink-0 text-base-content/60">
            {$t("panel.event.repeat")}
          </dt>
          <dd class="min-w-0">
            {$t(`panel.event.recurrences.${event.recurrence}`)}
          </dd>
        </div>

        <div class="flex gap-3">
          <dt class="w-20 shrink-0 text-base-content/60">
            {$t("panel.event.color")}
          </dt>
          <dd class="flex min-w-0 items-center gap-2">
            <span class={["size-2 rounded-full", meta.chip]}></span>
            {$t(meta.label)}
          </dd>
        </div>
      </dl>

      <div class="mt-5 flex flex-col gap-1.5 border-t border-base-300 pt-4">
        {@render caption($t("panel.event.notes"))}

        {#if event.notes}
          <NoteText text={event.notes} />
        {:else}
          <p class="text-sm leading-relaxed text-base-content/50">
            {$t("panel.event.noNotes")}
          </p>
        {/if}
      </div>
    {/if}
  </div>
</div>
