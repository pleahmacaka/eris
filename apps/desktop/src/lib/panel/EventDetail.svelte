<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import { t } from "svelte-i18n"
  import { eventSpan, longDay, shortDay, tagLabel } from "$lib/calendar"
  import {
    citationOf,
    events,
    isDone,
    type Occurrence,
    parseLocal,
    RECURRENCES,
    type Scope,
    SHIFTS,
    shiftable,
  } from "$lib/data"
  import { colorMeta, eventColors, toColor } from "./colors"
  import {
    type Draft,
    draftFrom,
    eventFrom,
    finalTitle,
    isValid,
    type Seed,
  } from "./draft"
  import { type NotePage, notePages } from "$lib/native"
  import NoteText from "./NoteText.svelte"
  import type { Panel } from "./panel.svelte"
  import TagPicker from "./TagPicker.svelte"

  type Field = "date" | "time" | "repeat" | "color" | "reminder" | "tags" | "parent" | "task" | "add"

  const { panel }: { panel: Panel } = $props()

  const REMINDERS: (number | null)[] = [null, 0, 5, 10, 15, 30, 60, 1440]

  const SHIFT_OPTIONS = ["none", ...SHIFTS] as const

  const event = $derived(panel.openEvent)

  const view = $derived(panel.view)

  const seed = $derived<Seed>(
    view.kind === "new" ? view : { day: panel.selected, span: 0, parent: null },
  )

  const reminderDefault = () => panel.profile.calendar.reminderMinutes || null

  let draft = $state<Draft>(untrack(() => draftFrom(event, seed, reminderDefault())))
  let open = $state<Field | null>(null)
  let writingNotes = $state(false)
  let scope: Scope | null = null
  let reference = $state<{ from: number; to: number } | null>(null)
  let pages = $state<NotePage[]>([])
  let picked = $state(0)
  let lookup: ReturnType<typeof setTimeout> | undefined

  const LOOKUP_DELAY = 120

  const referencing = $derived(panel.device.note.enabled && panel.device.note.references)

  $effect(() => {
    const current = event

    void current?.updatedAt

    untrack(() => {
      if (current && open === null && !writingNotes && document.activeElement?.tagName !== "INPUT") {
        draft = draftFrom(current, seed, reminderDefault())
      }
    })
  })

  const meta = $derived(colorMeta[draft.color])

  const done = $derived(event ? isDone(event) : false)

  const day = $derived(parseLocal(draft.date))

  const tags = $derived(
    panel.profile.calendar.tags.filter(tag => draft.tags.includes(tag.id)),
  )

  const parent = $derived(event ? panel.parentOf(event) : undefined)

  const children = $derived(event && !event.parentId ? panel.childrenOf(event) : [])

  const locked = $derived(event !== null && panel.hasChildren(event))

  const parentChoices = $derived(
    panel.shown
      .filter(e => e.id !== event?.id && panel.isRoot(e))
      .sort((a, b) => parseLocal(b.start).getTime() - parseLocal(a.start).getTime()),
  )

  const optional = $derived<Field[]>(
    [
      draft.reminder === null && "reminder",
      draft.tags.length === 0 && "tags",
      draft.parent === null && !locked && "parent",
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

  const timeLabel = $derived(
    draft.allDay
      ? $t("panel.allDay")
      : draft.hasEnd
        ? `${draft.start} – ${draft.end}`
        : draft.start,
  )

  const unchanged = () =>
    event !== null &&
    JSON.stringify(draftFrom(event, seed, reminderDefault())) === JSON.stringify(draft)

  const commit = async () => {
    if (!isValid(draft) || unchanged()) {
      return
    }

    if (!event) {
      await panel.createEvent(eventFrom(draft, undefined, Date.now()))

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

  const findReference = (area: HTMLTextAreaElement) => {
    const caret = area.selectionStart
    const before = area.value.slice(0, caret)
    const from = before.lastIndexOf("[[")
    const query = from < 0 ? "" : before.slice(from + 2)

    clearTimeout(lookup)

    if (!referencing || from < 0 || query.includes("]") || query.includes("\n")) {
      reference = null
      pages = []

      return
    }

    reference = { from, to: caret }
    lookup = setTimeout(() => {
      notePages(query)
        .then(found => {
          pages = found
          picked = 0
        })
        .catch(() => (pages = []))
    }, LOOKUP_DELAY)
  }

  const insertReference = (area: HTMLTextAreaElement, page: NotePage) => {
    if (!reference) {
      return
    }

    const link = citationOf(page.title, page.path)
    const next = draft.notes.slice(0, reference.from) + link + draft.notes.slice(reference.to)
    const caret = reference.from + link.length

    draft = { ...draft, notes: next }
    area.value = next
    area.setSelectionRange(caret, caret)
    reference = null
    pages = []
  }

  // the panel closes the detail on Escape, so the suggestion list keeps its keys
  const notesKey = (e: KeyboardEvent & { currentTarget: HTMLTextAreaElement }) => {
    if (!reference || pages.length === 0) {
      return
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      picked = (picked + (e.key === "ArrowDown" ? 1 : pages.length - 1)) % pages.length
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      insertReference(e.currentTarget, pages[picked])
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      reference = null
      pages = []
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
  {:else if field === "time"}
    <label class="flex cursor-pointer items-center justify-between">
      {$t("panel.allDay")}
      <input
        type="checkbox"
        class="toggle toggle-primary toggle-sm"
        checked={draft.allDay}
        onchange={e => change({ allDay: e.currentTarget.checked })}
      />
    </label>

    {#if !draft.allDay}
      <div class="flex items-center gap-2">
        <input
          type="time"
          class="input input-sm min-w-0 flex-1 tabular-nums"
          aria-label={$t("panel.event.start")}
          value={draft.start}
          onchange={e => e.currentTarget.value && change({ start: e.currentTarget.value })}
        />

        {#if draft.hasEnd}
          <span class="text-base-content/50">–</span>

          <input
            type="time"
            class="input input-sm min-w-0 flex-1 tabular-nums"
            aria-label={$t("panel.event.end")}
            value={draft.end}
            onchange={e => e.currentTarget.value && change({ end: e.currentTarget.value })}
          />
        {/if}
      </div>

      <button
        type="button"
        class="btn btn-ghost btn-xs justify-start"
        onclick={() => change({ hasEnd: !draft.hasEnd })}
      >
        <Icon icon={draft.hasEnd ? "lucide:x" : "lucide:plus"} class="size-3.5" />
        {draft.hasEnd ? $t("panel.event.removeEnd") : $t("panel.event.addEnd")}
      </button>
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
  {:else if field === "color"}
    <div class="flex flex-wrap gap-2 p-0.5">
      {#each eventColors as option (option)}
        <button
          type="button"
          class={[
            "size-5 cursor-pointer rounded-full ring-2 ring-offset-2 ring-offset-base-100",
            "transition-shadow duration-120",
            colorMeta[option].chip,
            draft.color === option ? "ring-base-content/80" : "ring-transparent hover:ring-base-content/25",
          ]}
          aria-label={$t(colorMeta[option].label)}
          aria-pressed={draft.color === option}
          onclick={() => change({ color: option })}
        ></button>
      {/each}
    </div>
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
  {:else if field === "parent"}
    <select
      class="select select-sm w-full"
      value={draft.parent}
      onchange={e => change({ parent: e.currentTarget.value || null })}
    >
      <option value="">{$t("common.none")}</option>
      {#each parentChoices as option (option.id)}
        <option value={option.id}>{option.title}, {shortDay(parseLocal(option.start))}</option>
      {/each}
    </select>
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

<div class="flex h-full min-h-0 flex-col">
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
        {@render value("date", () => longDay(day))}
      </div>

      <div class="flex gap-3">
        {@render label($t("panel.detail.time"))}
        {@render value("time", () => timeLabel)}
      </div>

      <div class="flex gap-3">
        {@render label($t("panel.event.repeat"))}
        {@render value("repeat", () => $t(`panel.event.recurrences.${draft.recurrence}`))}
      </div>

      <div class="flex gap-3">
        {@render label($t("panel.event.color"))}
        {@render value("color", () => $t(meta.label))}
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

      {#if draft.parent !== null || open === "parent"}
        <div class="flex gap-3">
          {@render label($t("panel.event.parent"))}
          {@render value("parent", () => parent?.title ?? $t("common.none"))}
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

    {#if event && !event.parentId}
      <div class="mt-5 flex flex-col gap-1.5 border-t border-base-300 pt-4">
        <span class="text-2xs font-medium text-base-content/60">
          {$t("panel.event.children")}
        </span>

        {#if children.length > 0}
          <ul class="-mx-2 flex flex-col">
            {#each children as child (child.id)}
              <li>
                <button
                  type="button"
                  class="flex w-full cursor-pointer items-start gap-2.5 rounded-field px-2 py-1.5 text-left transition-colors duration-120 hover:bg-base-content/5"
                  onclick={() => panel.show(child)}
                >
                  <span
                    class={["mt-1.5 size-2 shrink-0 rounded-full", colorMeta[toColor(child.color)].chip]}
                  ></span>
                  <span class="flex min-w-0 flex-1 flex-col">
                    <span class={["text-sm font-medium break-words", isDone(child) && "line-through opacity-60"]}>
                      {child.title}
                    </span>
                    <span class="text-2xs tabular-nums text-base-content/60">
                      {shortDay(parseLocal(child.start))}
                      {eventSpan(child, $t("panel.allDay"))}
                    </span>
                  </span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}

        <button
          type="button"
          class="btn btn-ghost btn-sm justify-start"
          onclick={() => panel.startChild(event)}
        >
          <Icon icon="lucide:plus" class="size-3.5" />
          {$t("panel.event.addChild")}
        </button>
      </div>
    {/if}

    <div class="mt-5 flex flex-col gap-1.5 border-t border-base-300 pt-4">
      <span class="text-2xs font-medium text-base-content/60">
        {$t("panel.event.notes")}
      </span>

      {#if writingNotes}
        <div class="relative">
          <textarea
            class="textarea textarea-sm w-full text-sm [field-sizing:content]"
            rows="3"
            value={draft.notes}
            {@attach node => node.focus()}
            oninput={e => {
              draft.notes = e.currentTarget.value
              findReference(e.currentTarget)
            }}
            onkeydown={notesKey}
            onblur={() => {
              writingNotes = false
              reference = null
              pages = []
              commit()
            }}
          ></textarea>

          {#if reference && pages.length > 0}
            <ul class="eris-card absolute top-full left-0 z-30 mt-1 flex w-full flex-col p-1 text-sm">
              {#each pages as page, index (page.path)}
                <li>
                  <button
                    type="button"
                    class={[
                      "flex w-full min-w-0 items-center gap-2 rounded-field px-2 py-1.5 text-left",
                      index === picked ? "bg-base-content/8" : "hover:bg-base-content/6",
                    ]}
                    onmousedown={e => {
                      e.preventDefault()

                      const area = e.currentTarget.closest("div")?.querySelector("textarea")

                      if (area) {
                        insertReference(area, page)
                      }
                    }}
                  >
                    <Icon icon="lucide:file-text" class="size-3.5 shrink-0 text-primary" />
                    <span class="min-w-0 truncate">{page.title}</span>
                    <span class="ml-auto min-w-0 truncate text-2xs text-base-content/45">{page.path}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {:else}
        <div
          role="button"
          tabindex="0"
          class="-mx-2 cursor-text rounded-field px-2 py-1 text-left transition-colors duration-120 hover:bg-base-content/6"
          onclick={e => {
            if (!(e.target as Element).closest("button")) {
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
            <span class="text-sm text-base-content/45">{$t("panel.event.addNotes")}</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
