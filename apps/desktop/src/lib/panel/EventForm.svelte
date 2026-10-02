<script lang="ts">
  import Icon from "@iconify/svelte"
  import { untrack } from "svelte"
  import { t } from "svelte-i18n"
  import { shortDay } from "$lib/calendar"
  import {
    addDays,
    events,
    type Occurrence,
    parseLocal,
    parseTimeToken,
    RECURRENCES,
    SHIFTS,
    shiftable,
  } from "$lib/data"
  import { colorMeta, eventColors } from "./colors"
  import {
    clockAt,
    draftFrom,
    eventFrom,
    isValid,
    type Seed,
    withTime,
  } from "./draft"
  import type { Panel } from "./panel.svelte"
  import TagPicker from "./TagPicker.svelte"

  const {
    panel,
    event,
    seed,
  }: { panel: Panel; event: Occurrence | null; seed: Seed } = $props()

  const REMINDERS: (number | null)[] = [null, 0, 5, 10, 15, 30, 60, 1440]

  const SHIFT_OPTIONS = ["none", ...SHIFTS] as const

  let draft = $state(
    untrack(() =>
      draftFrom(event, seed, panel.profile.calendar.reminderMinutes || null),
    ),
  )

  let applied = untrack(() => parseTimeToken(draft.title)?.minutes ?? null)
  let titleInput = $state<HTMLInputElement>()
  let titleMirror = $state<HTMLDivElement>()

  const token = $derived(draft.allDay ? null : parseTimeToken(draft.title))

  const day = $derived(draft.date ? parseLocal(draft.date) : null)

  const valid = $derived(isValid(draft))

  const locked = $derived(event !== null && panel.hasChildren(event))

  const parentChoices = $derived(
    panel.shown
      .filter(e => e.id !== event?.id && panel.isRoot(e))
      .sort(
        (a, b) => parseLocal(b.start).getTime() - parseLocal(a.start).getTime(),
      ),
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

    return $t("panel.event.reminders.minutesBefore", {
      values: { count: minutes },
    })
  }

  const syncMirror = () => {
    if (titleMirror && titleInput) {
      titleMirror.scrollLeft = titleInput.scrollLeft
    }
  }

  const ontitle = () => {
    syncMirror()

    const at = parseTimeToken(draft.title)?.minutes ?? null

    if (at === applied) {
      return
    }

    applied = at

    if (at !== null) {
      draft = withTime(draft, at)
    }
  }

  const save = async () => {
    if (!valid) {
      return
    }

    const stored = event ? await events.get(event.id) : undefined

    await panel.saveEvent(event, eventFrom(draft, stored, Date.now()))
  }
</script>

{#snippet caption(text: string)}
  <span class="text-2xs font-medium text-base-content/60">{text}</span>
{/snippet}

<div class="flex flex-col gap-4">
  <label class="flex flex-col gap-1">
    {@render caption($t("panel.title"))}
    <div class="relative">
      {#if token}
        <div
          bind:this={titleMirror}
          aria-hidden="true"
          class={[
            "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre",
            "border-b border-transparent px-0 py-1.5 text-lg font-semibold",
            "text-transparent",
          ]}
        >{draft.title.slice(0, token.start)}<mark class="rounded-sm bg-primary/25 text-transparent">{draft.title.slice(token.start, token.end)}</mark>{draft.title.slice(token.end)}</div>
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
        bind:value={draft.title}
        onscroll={syncMirror}
        oninput={ontitle}
      />
    </div>

    {#if day}
      <span class="text-2xs tabular-nums text-base-content/60">
        {draft.days > 0
          ? `${shortDay(day)} – ${shortDay(addDays(day, draft.days))}`
          : shortDay(day)}
      </span>
    {/if}

    {#if token}
      <span class="text-2xs text-primary">
        {$t("panel.event.timeFromTitle", {
          values: { time: clockAt(token.minutes) },
        })}
      </span>
    {/if}
  </label>

  <div class="flex flex-col gap-3">
    <label class="flex flex-col gap-1">
      {@render caption($t("panel.event.date"))}
      <input
        type="date"
        class="input input-sm w-full tabular-nums"
        bind:value={draft.date}
      />
    </label>

    <label class="flex cursor-pointer items-center justify-between">
      <span class="text-sm">{$t("panel.allDay")}</span>
      <input
        type="checkbox"
        class="toggle toggle-primary toggle-sm"
        bind:checked={draft.allDay}
      />
    </label>

    {#if !draft.allDay}
      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
          {@render caption($t("panel.event.start"))}
          <input
            type="time"
            class="input input-sm w-full tabular-nums"
            bind:value={draft.start}
          />
        </label>

        <div class="flex flex-col gap-1">
          {@render caption($t("panel.event.end"))}

          {#if draft.hasEnd}
            <div class="flex items-center gap-1">
              <input
                type="time"
                class="input input-sm min-w-0 flex-1 tabular-nums"
                aria-label={$t("panel.event.end")}
                bind:value={draft.end}
              />

              <button
                type="button"
                class="btn btn-ghost btn-square btn-sm"
                aria-label={$t("panel.event.removeEnd")}
                onclick={() => (draft.hasEnd = false)}
              >
                <Icon icon="lucide:x" class="size-3.5" />
              </button>
            </div>
          {:else}
            <button
              type="button"
              class="btn btn-ghost btn-sm justify-start"
              onclick={() => (draft.hasEnd = true)}
            >
              <Icon icon="lucide:plus" class="size-3.5" />
              {$t("panel.event.addEnd")}
            </button>
          {/if}
        </div>
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
            draft.color === option
              ? "ring-base-content/80"
              : "ring-transparent hover:ring-base-content/25",
          ]}
          aria-label={$t(colorMeta[option].label)}
          aria-pressed={draft.color === option}
          onclick={() => (draft.color = option)}
        ></button>
      {/each}
    </div>
  </div>

  <div class="grid grid-cols-2 gap-3">
    <label class="flex flex-col gap-1">
      {@render caption($t("panel.event.repeat"))}
      <select class="select select-sm w-full" bind:value={draft.recurrence}>
        {#each RECURRENCES as option (option)}
          <option value={option}>{$t(`panel.event.recurrences.${option}`)}</option>
        {/each}
      </select>
    </label>

    <label class="flex flex-col gap-1">
      {@render caption($t("panel.event.reminder"))}
      <select class="select select-sm w-full" bind:value={draft.reminder}>
        {#each REMINDERS as option (option)}
          <option value={option}>{reminderLabel(option)}</option>
        {/each}
      </select>
    </label>
  </div>

  {#if shiftable(draft.recurrence)}
    <label class="flex flex-col gap-1">
      {@render caption($t("panel.event.shift"))}
      <select class="select select-sm w-full" bind:value={draft.shift}>
        {#each SHIFT_OPTIONS as option (option)}
          <option value={option}>{$t(`panel.event.shifts.${option}`)}</option>
        {/each}
      </select>
    </label>
  {/if}

  <div class="flex flex-col gap-2">
    {@render caption($t("panel.event.tags"))}
    <TagPicker {panel} bind:selected={draft.tags} />
  </div>

  <label class="flex flex-col gap-1">
    {@render caption($t("panel.event.parent"))}
    <select
      class="select select-sm w-full"
      bind:value={draft.parent}
      disabled={locked}
    >
      <option value={null}>{$t("common.none")}</option>
      {#each parentChoices as choice (choice.id)}
        <option value={choice.id}>
          {choice.title}, {shortDay(parseLocal(choice.start))}
        </option>
      {/each}
    </select>

    {#if locked}
      <span class="text-2xs text-base-content/60">
        {$t("panel.event.parentLocked")}
      </span>
    {/if}
  </label>

  <label class="flex flex-col gap-1">
    {@render caption($t("panel.event.notes"))}
    <textarea class="textarea w-full text-sm" rows="5" bind:value={draft.notes}
    ></textarea>
  </label>

  <div class="mt-1 flex gap-2">
    <button class="btn btn-sm btn-ghost flex-1" onclick={panel.close}>
      {$t("common.cancel")}
    </button>

    <button
      class="btn btn-sm btn-primary flex-1"
      disabled={!valid}
      onclick={save}
    >
      {$t("common.save")}
    </button>
  </div>
</div>
