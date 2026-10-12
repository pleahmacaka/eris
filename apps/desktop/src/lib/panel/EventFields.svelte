<script lang="ts">
  import { currentLocale } from "@eris/i18n"
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { tagLabel } from "#lib/calendar/index.js"
  import { RECURRENCES, SHIFTS, shiftable } from "#lib/data/index.js"
  import DateEditor from "./DateEditor.svelte"
  import { reminderLabel, whenLabel } from "./detail-labels"
  import type { EditingState, Field } from "./editing.svelte"
  import type { Panel } from "./panel.svelte"
  import TagPicker from "./TagPicker.svelte"

  const { panel, editor }: { panel: Panel; editor: EditingState } = $props()
  const draft = $derived(editor.draft)
  const open = $derived(editor.open)
  const REMINDERS: (number | null)[] = [null, 0, 5, 10, 15, 30, 60, 1440]
  const SHIFT_OPTIONS = ["none", ...SHIFTS] as const
  const tags = $derived(
    panel.profile.calendar.tags.filter(tag => draft.tags.includes(tag.id)),
  )
  const optional = $derived<Field[]>(
    [
      draft.reminder === null && "reminder",
      draft.tags.length === 0 && "tags",
      !draft.task && "task",
    ].filter((field): field is Field => field !== false),
  )
  const when = $derived(whenLabel(draft, panel.today, currentLocale(), $t))

  const onmousedown = (e: MouseEvent) => {
    if (open && !(e.target as Element).closest("[data-pop]")) {
      editor.open = null
    }
  }

  // The panel closes on Escape; the popover takes the key first.
  const onkeydowncapture = (e: KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      e.stopPropagation()
      editor.open = null
    }
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
      onclick={() => editor.toggle(field)}
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
    <DateEditor {draft} change={editor.change} />
  {:else if field === "repeat"}
    <div class="flex flex-col">
      {#each RECURRENCES as option (option)}
        {@render choice(draft.recurrence === option, $t(`panel.event.recurrences.${option}`), () =>
          editor.change({ recurrence: option }),
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
              editor.change({ shift })
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
        {@render choice(draft.reminder === option, reminderLabel(option, $t), () =>
          editor.change({ reminder: option }),
        )}
      {/each}
    </div>
  {:else if field === "tags"}
    <TagPicker
      {panel}
      bind:selected={() => draft.tags, next => editor.change({ tags: next })}
    />
  {:else if field === "task"}
    <label class="flex cursor-pointer items-center justify-between">
      {$t("panel.task.label")}
      <input
        type="checkbox"
        class="toggle toggle-primary toggle-sm"
        checked={draft.task}
        onchange={e => editor.change({ task: e.currentTarget.checked })}
      />
    </label>
  {/if}
{/snippet}

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
      {@render value("reminder", () => reminderLabel(draft.reminder, $t))}
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
        onclick={() => editor.toggle("add")}
      >
        <Icon icon="lucide:plus" class="size-3.5" />
        {$t("panel.event.addField")}
      </button>

      {#if open === "add"}
        <div class="eris-card absolute top-full left-0 z-30 mt-1 flex w-48 flex-col p-1.5 text-sm">
          {#each optional as field (field)}
            {@render choice(false, $t(`panel.event.fields.${field}`), () => editor.addField(field))}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</dl>
