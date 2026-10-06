<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import { clock, shortDay, tagLabel, tagsOf } from "$lib/calendar"
  import { type CalendarEvent, isDone, openEnded, parseLocal } from "$lib/data"
  import { colorMeta, toColor } from "./colors"
  import type { Panel } from "./panel.svelte"

  const { panel }: { panel: Panel } = $props()

  const day = $derived(panel.selected)

  const events = $derived(panel.dayEvents)

  const allDay = $derived(events.filter(e => e.allDay))

  const timed = $derived(events.filter(e => !e.allDay))

  const holidays = $derived(panel.holidayFor(day))

  const labelsOf = (event: CalendarEvent) =>
    tagsOf(panel.profile.calendar.tags, event).map(tagLabel)

  const heading = $derived(
    day.toLocaleDateString(currentLocale(), { month: "long", day: "numeric" }),
  )

  const weekday = $derived(
    day.toLocaleDateString(currentLocale(), { weekday: "long" }),
  )

  let dragId = $state<string | null>(null)
  let overId = $state<string | null>(null)
  let overAfter = $state(false)

  const onDragStart = (e: DragEvent, id: string) => {
    dragId = id

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
    }
  }

  const onDragOver = (e: DragEvent, id: string) => {
    if (!dragId || id === dragId) {
      return
    }

    e.preventDefault()

    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()

    overAfter = e.clientY > box.top + box.height / 2
    overId = id
  }

  const onDrop = async (e: DragEvent, id: string) => {
    e.preventDefault()

    const from = dragId

    reset()

    if (from) {
      await panel.reorderDay(from, id, overAfter)
    }
  }

  const reset = () => {
    dragId = null
    overId = null
  }
</script>

<section
  class="flex h-full min-h-0 flex-col"
  aria-label={$t("panel.day.title", { values: { date: heading } })}
>
  <header class="flex flex-col justify-center border-b border-base-300 px-4 py-2.5">
    <div class="flex items-baseline justify-between gap-2">
      <h2 class="truncate text-sm font-semibold tracking-tight">
        {heading}
        <span class="ml-1 text-xs font-normal text-base-content/60">
          {weekday}
        </span>
      </h2>

      {#if events.length > 0}
        <span class="badge badge-ghost badge-xs shrink-0 tabular-nums">
          {$t("panel.day.count", { values: { count: events.length } })}
        </span>
      {/if}
    </div>

    {#if holidays.length > 0}
      <div class="mt-1.5 flex flex-wrap gap-1">
        {#each holidays as name (name)}
          <span
            class={[
              "badge badge-sm badge-soft max-w-full gap-1",
              panel.isHoliday(day) ? "badge-error" : "badge-neutral",
            ]}
            title={$t("panel.holiday")}
          >
            <Icon icon="lucide:flag" class="size-3 shrink-0" />
            <span class="truncate">{name}</span>
          </span>
        {/each}
      </div>
    {/if}
  </header>

  {#snippet row(event: (typeof events)[number], movable: boolean)}
    {@const meta = colorMeta[toColor(event.color)]}
    {@const parent = panel.parentOf(event)?.title}
    {@const labels = labelsOf(event)}
    {@const done = isDone(event)}
    <li
      class={["group relative", dragId === event.id && "opacity-40"]}
      draggable={movable}
      ondragstart={movable ? e => onDragStart(e, event.id) : undefined}
      ondragover={movable ? e => onDragOver(e, event.id) : undefined}
      ondrop={movable ? e => onDrop(e, event.id) : undefined}
      ondragend={reset}
    >
      {#if movable && overId === event.id}
        <span class={["drop-line", overAfter && "is-after"]}></span>
      {/if}

      <div
        class={[
          "flex items-stretch gap-1 rounded-field",
          "transition-colors duration-120 hover:bg-base-content/5",
        ]}
      >
        <span
          class={[
            "flex w-5 shrink-0 cursor-grab items-center justify-center",
            "text-base-content/25 transition-colors group-hover:text-base-content/45",
            !movable && "cursor-default opacity-25 group-hover:text-base-content/25",
          ]}
          aria-hidden="true"
        >
          <Icon icon="lucide:grip-vertical" class="size-3.5" />
        </span>

        <span
          class={[
            "flex w-11 shrink-0 flex-col pt-2 text-2xs tabular-nums",
            "text-base-content/70",
          ]}
        >
          {#if event.allDay}
            {$t("panel.allDay")}
          {:else}
            <span class="font-medium">{clock(event.start)}</span>
            {#if !openEnded(event)}
              <span class="text-base-content/50">{clock(event.end)}</span>
            {/if}
          {/if}
        </span>

        <span class="flex w-4 shrink-0 items-start pt-2">
          {#if event.task}
            <input
              type="checkbox"
              class="checkbox checkbox-primary checkbox-xs"
              checked={done}
              aria-label={$t(done ? "panel.task.undo" : "panel.task.done")}
              onchange={() => panel.toggleDone(event)}
            />
          {:else}
            <span class={["mt-1 size-2 rounded-full", meta.chip]}></span>
          {/if}
        </span>

        <button
          type="button"
          class={[
            "flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 py-2 pr-9",
            "text-left outline-none focus-visible:rounded-field",
            "focus-visible:ring-2 focus-visible:ring-primary/50",
          ]}
          onclick={() => panel.show(event)}
        >
          <span
            class={[
              "line-clamp-2 text-sm font-medium break-words",
              done && "text-base-content/50 line-through",
            ]}
          >
            {event.title}
          </span>

          {#if event.shiftedFrom}
            <span class="text-2xs text-warning">
              {$t("panel.event.movedFrom", {
                values: { date: shortDay(parseLocal(event.shiftedFrom)) },
              })}
            </span>
          {/if}

          {#if parent || labels.length > 0}
            <span
              class={[
                "flex min-w-0 flex-wrap items-center gap-x-1.5",
                "text-2xs text-base-content/55",
              ]}
            >
              {#if parent}
                <span class="flex min-w-0 items-center gap-0.5">
                  <Icon
                    icon="lucide:corner-down-right"
                    class="size-3 shrink-0"
                  />
                  <span class="truncate">{parent}</span>
                </span>
              {/if}

              {#each labels as label (label)}
                <span>#{label}</span>
              {/each}
            </span>
          {/if}
        </button>

        <button
          type="button"
          class={[
            "btn btn-ghost btn-square btn-xs absolute top-1.5 right-1.5",
            "text-base-content/60 opacity-0 transition-opacity duration-120",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            "hover:text-error focus-visible:opacity-100",
          ]}
          aria-label={$t("common.delete")}
          onclick={() => panel.remove(event)}
        >
          <Icon icon="lucide:trash-2" class="size-3.5" />
        </button>
      </div>
    </li>
  {/snippet}

  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    {#if events.length === 0}
      <div
        class={[
          "flex h-full flex-col items-center justify-center gap-2",
          "text-base-content/50",
        ]}
      >
        <Icon icon="lucide:calendar" class="size-6 opacity-60" />
        <p class="text-xs">{$t("panel.day.empty")}</p>
      </div>
    {:else}
      {#if allDay.length > 0}
        <ul class="flex flex-col">
          {#each allDay as event (event.id + event.start)}
            {@render row(event, true)}
          {/each}
        </ul>
      {/if}

      {#if allDay.length > 0 && timed.length > 0}
        <div class="my-1.5 border-t border-base-300/70"></div>
      {/if}

      {#if timed.length > 0}
        <ul class="flex flex-col">
          {#each timed as event (event.id + event.start)}
            {@render row(event, false)}
          {/each}
        </ul>
      {/if}
    {/if}
  </div>

  <div class="flex flex-col border-t border-base-300 p-2">
    <button class="btn btn-sm btn-ghost justify-start" onclick={panel.startNew}>
      <Icon icon="lucide:plus" class="size-3.5" />
      {$t("panel.day.add")}
    </button>
  </div>
</section>

<style>
  .drop-line {
    position: absolute;
    left: 0.25rem;
    right: 0.25rem;
    top: -1px;
    height: 2px;
    border-radius: 9999px;
    background: var(--color-primary);
    z-index: 10;
  }

  .drop-line.is-after {
    top: auto;
    bottom: -1px;
  }
</style>
