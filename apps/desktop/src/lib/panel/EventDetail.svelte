<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import { dateLabel, dayPeriod, tagLabel } from "$lib/calendar"
  import {
    addDays,
    events,
    isDone,
    type Occurrence,
    parseLocal,
    RECURRENCES,
    type Scope,
    SHIFTS,
    setNotesSync,
    shareOccurrenceNotes,
    shiftable,
  } from "$lib/data"
  import { colorMeta } from "./colors"
  import {
    type Draft,
    draftFrom,
    eventFrom,
    finalTitle,
    isValid,
    type Seed,
  } from "./draft"
  import MemoEditor from "./MemoEditor.svelte"
  import NoteText from "./NoteText.svelte"
  import type { Panel } from "./panel.svelte"
  import RelationField from "./RelationField.svelte"
  import ScopeSheet from "./ScopeSheet.svelte"
  import TagPicker from "./TagPicker.svelte"

  type Field = "date" | "repeat" | "reminder" | "tags" | "task" | "add"

  const { panel }: { panel: Panel } = $props()

  const REMINDERS: (number | null)[] = [null, 0, 5, 10, 15, 30, 60, 1440]

  const SHIFT_OPTIONS = ["none", ...SHIFTS] as const

  const event = $derived(panel.openEvent)

  const view = $derived(panel.view)

  const seed = $derived<Seed>(
    view.kind === "new" ? view : { day: panel.selected, span: 0, parent: null },
  )

  const reminderDefault = () => panel.profile.calendar.reminderMinutes || null

  const keepKey = untrack(() => (view.kind === "event" ? `${view.id}@${view.date}` : "new"))

  let draft = $state<Draft>(
    untrack(() =>
      panel.kept?.key === keepKey ? panel.kept.draft : draftFrom(event, seed, reminderDefault()),
    ),
  )
  let seenStamp = untrack(() => event?.updatedAt)
  let open = $state<Field | null>(null)
  let writingNotes = $state(false)
  let scope: Scope | null = null
  const referencing = $derived(panel.device.note.enabled && panel.device.note.references)

  $effect(() => {
    const idle = requestIdleCallback(() => import("@eris/live-editor"))

    return () => cancelIdleCallback(idle)
  })

  $effect(() => {
    const current = event

    if (current?.updatedAt === seenStamp) {
      return
    }

    seenStamp = current?.updatedAt

    untrack(() => {
      if (current && open === null && !writingNotes && document.activeElement?.tagName !== "INPUT") {
        draft = draftFrom(current, seed, reminderDefault())
      }
    })
  })

  $effect(() => {
    panel.kept = { key: keepKey, draft: $state.snapshot(draft) }
  })

  const pickTime = (e: MouseEvent & { currentTarget: HTMLInputElement }) => {
    e.currentTarget.showPicker()
  }

  $effect(() => {
    if (panel.asking) {
      untrack(() => {
        open = null
      })
    }
  })

  const meta = $derived(colorMeta[panel.colorOf(draft.tags)])

  const done = $derived(event ? isDone(event) : false)

  const day = $derived(parseLocal(draft.date))

  const tags = $derived(
    panel.profile.calendar.tags.filter(tag => draft.tags.includes(tag.id)),
  )

  const locked = $derived(event !== null && panel.hasChildren(event))

  const optional = $derived<Field[]>(
    [
      draft.reminder === null && "reminder",
      draft.tags.length === 0 && "tags",
      !draft.task && "task",
    ].filter((field): field is Field => field !== false),
  )

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

    return $t("panel.event.reminders.minutesBefore", { values: { count: minutes } })
  }

  const spoken = (time: string) => {
    const [hour, minute] = time.split(":").map(Number)
    const values = {
      period: dayPeriod(hour),
      hour: hour % 12 || 12,
      minute,
      padded: String(minute).padStart(2, "0"),
    }

    return $t(minute === 0 ? "panel.clock.hour" : "panel.clock.minute", { values })
  }

  const repeatDate = (date: Date) => {
    const locale = currentLocale()

    switch (draft.recurrence) {
      case "daily":
      case "weekdays":
        return $t(`panel.event.every.${draft.recurrence}`)
      case "weekly":
        return $t("panel.event.every.weekly", {
          values: { date: date.toLocaleDateString(locale, { weekday: "long" }) },
        })
      case "monthly":
        return $t("panel.event.every.monthly", {
          values: { date: date.toLocaleDateString(locale, { day: "numeric" }) },
        })
      case "yearly":
        return $t("panel.event.every.yearly", {
          values: { date: date.toLocaleDateString(locale, { month: "long", day: "numeric" }) },
        })
      default:
        return dateLabel(date, panel.today)
    }
  }

  const when = $derived.by(() => {
    const date = repeatDate(day)
    const lastDay =
      draft.days > 0 && draft.recurrence === "none" ? dateLabel(addDays(day, draft.days), panel.today) : null

    if (draft.allDay) {
      return lastDay ? `${date} – ${lastDay}` : date
    }

    const start = `${date} ${spoken(draft.start)}`

    if (!draft.hasEnd) {
      return start
    }

    return lastDay ? `${start} – ${lastDay} ${spoken(draft.end)}` : `${start} – ${spoken(draft.end)}`
  })

  const matchesEvent = (next: Draft) =>
    event !== null &&
    JSON.stringify(draftFrom(event, seed, reminderDefault())) === JSON.stringify(next)

  const commit = async () => {
    if (!isValid(draft) || matchesEvent(draft)) {
      return
    }

    if (!event) {
      if (view.kind === "new") {
        await panel.createEvent(eventFrom(draft, undefined, Date.now()))
      }

      return
    }

    if (event.seriesDate && event.notesSync && matchesEvent({ ...draft, notes: event.notes })) {
      await shareOccurrenceNotes(event, draft.notes)

      return
    }

    if (event.seriesDate && !scope) {
      scope = await panel.askScope("edit")

      if (!scope) {
        draft = draftFrom(event, seed, reminderDefault())

        return
      }
    }

    const stored = await events.get(event.id)

    await panel.commitEvent(event, eventFrom(draft, stored, Date.now()), scope)
  }

  const change = (next: Partial<Draft>) => {
    draft = { ...draft, ...next }
    commit()
  }

  const toggle = (field: Field) => {
    open = open === field ? null : field
  }

  const onmousedown = (e: MouseEvent) => {
    if (open && !(e.target as Element).closest("[data-pop]")) {
      open = null
    }
  }

  // the panel closes the detail on Escape, so an open popover has to take the key first
  const onkeydowncapture = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation()
      open = null
    }
  }

  const titleKey = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    if (e.key === "Enter") {
      e.currentTarget.blur()
    }
  }

  const addField = (field: Field) => {
    if (field === "task") {
      change({ task: true })
      open = null

      return
    }

    if (field === "reminder") {
      draft = { ...draft, reminder: reminderDefault() ?? 10 }
      commit()
    }

    open = field
  }
</script>

<svelte:window {onmousedown} {onkeydowncapture} />

{#snippet label(text: string)}
  <dt class="w-16 shrink-0 pt-1 text-base-content/60">{text}</dt>
{/snippet}

{#snippet value(field: Field, content: () => string)}
  <dd class="relative min-w-0 flex-1" data-pop>
    <button
      type="button"
      class={[
        "-ml-2 flex w-full min-w-0 items-center gap-2 rounded-field px-2 py-1 text-left",
        "transition-colors duration-120 hover:bg-base-content/6",
        open === field && "bg-base-content/6",
      ]}
      aria-expanded={open === field}
      onclick={() => toggle(field)}
    >
      <span class="truncate">{content()}</span>
    </button>

    {#if open === field}
      <div class="eris-card absolute top-full right-0 z-30 mt-1 flex w-64 flex-col gap-2 p-3 text-sm">
        {@render popover(field)}
      </div>
    {/if}
  </dd>
{/snippet}

{#snippet choice(selected: boolean, text: string, pick: () => void)}
  <button
    type="button"
    class={[
      "flex items-center justify-between rounded-field px-2 py-1.5 text-left",
      "transition-colors duration-120 hover:bg-base-content/6",
      selected && "font-medium text-primary",
    ]}
    onclick={pick}
  >
    {text}

    {#if selected}
      <Icon icon="lucide:check" class="size-3.5" />
    {/if}
  </button>
{/snippet}

{#snippet popover(field: Field)}
  {#if field === "date"}
    <input
      type="date"
      class="input input-sm w-full tabular-nums"
      value={draft.date}
      onchange={e => e.currentTarget.value && change({ date: e.currentTarget.value })}
    />

    {#if draft.allDay}
      <button
        type="button"
        class="btn btn-ghost btn-xs justify-start"
        onclick={() => change({ allDay: false })}
      >
        <Icon icon="lucide:plus" class="size-3.5" />
        {$t("panel.event.addTime")}
      </button>
    {:else}
      <div class="flex items-center gap-2">
        <label class="input input-sm min-w-0 flex-1 gap-0 pr-1">
          <input
            type="time"
            class="time-field min-w-0 grow cursor-pointer tabular-nums"
            aria-label={$t("panel.event.start")}
            value={draft.start}
            onclick={pickTime}
            onchange={e => e.currentTarget.value && change({ start: e.currentTarget.value })}
          />

          <button
            type="button"
            class="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/60"
            aria-label={$t("panel.event.removeTime")}
            title={$t("panel.event.removeTime")}
            onclick={() => change({ allDay: true })}
          >
            <Icon icon="lucide:x" class="size-3.5" />
          </button>
        </label>

        {#if draft.hasEnd}
          <span class="text-base-content/50">–</span>

          <label class="input input-sm min-w-0 flex-1 gap-0 pr-1">
            <input
              type="time"
              class="time-field min-w-0 grow cursor-pointer tabular-nums"
              aria-label={$t("panel.event.end")}
              value={draft.end}
              onclick={pickTime}
              onchange={e => e.currentTarget.value && change({ end: e.currentTarget.value })}
            />

            <button
              type="button"
              class="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/60"
              aria-label={$t("panel.event.removeEnd")}
              title={$t("panel.event.removeEnd")}
              onclick={() => change({ hasEnd: false })}
            >
              <Icon icon="lucide:x" class="size-3.5" />
            </button>
          </label>
        {/if}
      </div>

      {#if !draft.hasEnd}
        <button
          type="button"
          class="btn btn-ghost btn-xs justify-start"
          onclick={() => change({ hasEnd: true })}
        >
          <Icon icon="lucide:plus" class="size-3.5" />
          {$t("panel.event.addEnd")}
        </button>
      {/if}
    {/if}
  {:else if field === "repeat"}
    <div class="flex flex-col">
      {#each RECURRENCES as option (option)}
        {@render choice(draft.recurrence === option, $t(`panel.event.recurrences.${option}`), () =>
          change({ recurrence: option }),
        )}
      {/each}
    </div>

    {#if shiftable(draft.recurrence)}
      <label class="flex flex-col gap-1 border-t border-base-content/10 pt-2 text-xs text-base-content/60">
        {$t("panel.event.shift")}
        <select
          class="select select-sm w-full"
          value={draft.shift}
          onchange={e => {
            const shift = SHIFT_OPTIONS.find(option => option === e.currentTarget.value)

            if (shift) {
              change({ shift })
            }
          }}
        >
          {#each SHIFT_OPTIONS as option (option)}
            <option value={option}>{$t(`panel.event.shifts.${option}`)}</option>
          {/each}
        </select>
      </label>
    {/if}
  {:else if field === "reminder"}
    <div class="flex flex-col">
      {#each REMINDERS as option (option)}
        {@render choice(draft.reminder === option, reminderLabel(option), () =>
          change({ reminder: option }),
        )}
      {/each}
    </div>
  {:else if field === "tags"}
    <TagPicker
      {panel}
      bind:selected={() => draft.tags, next => change({ tags: next })}
    />
  {:else if field === "task"}
    <label class="flex cursor-pointer items-center justify-between">
      {$t("panel.task.label")}
      <input
        type="checkbox"
        class="toggle toggle-primary toggle-sm"
        checked={draft.task}
        onchange={e => change({ task: e.currentTarget.checked })}
      />
    </label>
  {/if}
{/snippet}

<div class="flex h-full min-h-0 flex-col select-text">
  <header class="flex min-h-14 items-center gap-2 border-b border-base-300 px-3 py-3">
    <button
      type="button"
      class="btn btn-ghost btn-square btn-xs"
      aria-label={$t("common.back")}
      onclick={panel.close}
    >
      <Icon icon="lucide:arrow-left" class="size-3.5" />
    </button>

    <span class="flex-1"></span>

    {#if event}
      <button
        class="btn btn-ghost btn-square btn-xs text-error"
        aria-label={$t("common.delete")}
        onclick={() => panel.remove(event)}
      >
        <Icon icon="lucide:trash-2" class="size-3.5" />
      </button>
    {/if}
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
    <div class="flex items-start gap-2.5">
      {#if draft.task && event}
        <input
          type="checkbox"
          class="checkbox checkbox-primary checkbox-sm mt-1.5 shrink-0"
          checked={done}
          aria-label={$t(done ? "panel.task.undo" : "panel.task.done")}
          onchange={() => panel.toggleDone(event)}
        />
      {:else}
        <span class={["mt-2.5 size-2.5 shrink-0 rounded-full", meta.chip]}></span>
      {/if}

      <input
        class={[
          "min-w-0 flex-1 border-0 bg-transparent p-0 text-xl leading-tight font-semibold outline-none",
          "placeholder:text-base-content/35",
          done && "text-base-content/50 line-through",
        ]}
        placeholder={$t("panel.event.new")}
        aria-label={$t("panel.title")}
        value={draft.title}
        {@attach node => {
          if (!event) {
            node.focus()
          }
        }}
        oninput={e => (draft.title = e.currentTarget.value)}
        onblur={() => {
          if (finalTitle(draft)) {
            commit()
          }
        }}
        onkeydown={titleKey}
      />
    </div>

    <dl class="mt-5 flex flex-col gap-1 text-sm">
      <div class="flex gap-3">
        {@render label($t("panel.detail.date"))}
        {@render value("date", () => when)}
      </div>

      <div class="flex gap-3">
        {@render label($t("panel.event.repeat"))}
        {@render value("repeat", () => $t(`panel.event.recurrences.${draft.recurrence}`))}
      </div>

      {#if draft.reminder !== null}
        <div class="flex gap-3">
          {@render label($t("panel.event.reminder"))}
          {@render value("reminder", () => reminderLabel(draft.reminder))}
        </div>
      {/if}

      {#if draft.tags.length > 0 || open === "tags"}
        <div class="flex gap-3">
          {@render label($t("panel.event.tags"))}
          {@render value("tags", () => tags.map(tagLabel).join(", ") || $t("common.none"))}
        </div>
      {/if}

      {#if draft.task}
        <div class="flex gap-3">
          {@render label($t("panel.task.label"))}
          {@render value("task", () => $t("common.on"))}
        </div>
      {/if}

      {#if optional.length > 0}
        <div class="relative" data-pop>
          <button
            type="button"
            class="btn btn-ghost btn-xs mt-1 text-base-content/60"
            aria-expanded={open === "add"}
            onclick={() => toggle("add")}
          >
            <Icon icon="lucide:plus" class="size-3.5" />
            {$t("panel.event.addField")}
          </button>

          {#if open === "add"}
            <div class="eris-card absolute top-full left-0 z-30 mt-1 flex w-48 flex-col p-1.5 text-sm">
              {#each optional as field (field)}
                {@render choice(false, $t(`panel.event.fields.${field}`), () => addField(field))}
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </dl>

    <RelationField
      {panel}
      {event}
      parent={draft.parent}
      {locked}
      onparent={id => change({ parent: id })}
    />

    <div class="mt-5 flex flex-col gap-1.5 border-t border-base-300 pt-4">
      <span class="text-2xs font-medium text-base-content/60">
        {$t("panel.event.notes")}
      </span>

      {#if event?.seriesDate}
        {@const occurrence = event}
        <label class="flex cursor-pointer items-center gap-1.5 text-2xs text-base-content/45">
          {$t(occurrence.notesSync ? "panel.event.notesSync.all" : "panel.event.notesSync.ask")}
          <span class="ml-auto text-base-content/60">{$t("panel.event.notesSync.label")}</span>
          <input
            type="checkbox"
            class="toggle toggle-primary toggle-xs"
            checked={occurrence.notesSync ?? false}
            onchange={e => setNotesSync(occurrence, e.currentTarget.checked)}
          />
        </label>
      {/if}

      {#if writingNotes}
        <MemoEditor
          text={draft.notes}
          references={referencing}
          onchange={notes => (draft.notes = notes)}
          onblur={() => {
            writingNotes = false
            commit()
          }}
        />
      {:else}
        <div
          role="button"
          tabindex="0"
          class="-mx-2 cursor-text rounded-field px-2 py-1 text-left transition-colors duration-120 hover:bg-base-content/6"
          onclick={e => {
            if (!(e.target as Element).closest("button, a")) {
              writingNotes = true
            }
          }}
          onkeydown={e => {
            if (e.key === "Enter" && e.target === e.currentTarget) {
              writingNotes = true
            }
          }}
        >
          {#if draft.notes}
            <NoteText text={draft.notes} link={panel.device.note} />
          {:else}
            <span class="text-sm text-base-content/45">{$t("panel.event.writeNotes")}</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

{#if panel.asking}
  <ScopeSheet
    mode={panel.asking.mode}
    scoped={panel.asking.scoped}
    choose={panel.asking.answer}
    cancel={() => panel.asking?.answer(null)}
  />
{/if}

<style>
  .time-field::-webkit-calendar-picker-indicator {
    display: none;
  }
</style>
