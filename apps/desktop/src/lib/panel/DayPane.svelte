<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import { clock, shortDay, tagLabel, tagsOf } from "$lib/calendar"
  import { type Occurrence, isDone, openEnded, parseLocal } from "$lib/data"
  import type { Panel } from "./panel.svelte"

  type Zone = "before" | "after" | "group"

  const { panel }: { panel: Panel } = $props()

  const ranged = $derived(panel.rangeEnd !== null)

  const sections = $derived(panel.daySections)

  const monthDay = (day: Date) =>
    day.toLocaleDateString(currentLocale(), { month: "long", day: "numeric" })

  const heading = $derived(
    panel.rangeEnd
      ? `${monthDay(panel.selected)} – ${monthDay(panel.rangeEnd)}`
      : monthDay(panel.selected),
  )

  const weekday = $derived(
    ranged
      ? null
      : panel.selected.toLocaleDateString(currentLocale(), { weekday: "long" }),
  )

  const empty = $derived(
    sections.every(
      ({ day, events }) =>
        events.length === 0 &&
        panel.holidayFor(day).length === 0 &&
        panel.hiddenOn(day).length === 0,
    ),
  )

  const labelsOf = (event: Occurrence) =>
    tagsOf(panel.profile.calendar.tags, event).map(tagLabel)

  const keyOf = (event: Occurrence) => event.id + event.start

  const clusters = (list: Occurrence[]) => {
    const members = Map.groupBy(
      list.filter(e => e.group),
      e => e.group ?? "",
    )
    const placed = new Set<string>()

    return list.flatMap(e => {
      const group = e.group ? members.get(e.group) : undefined

      if (!e.group || !group || group.length < 2) {
        return [[e]]
      }

      if (placed.has(e.group)) {
        return []
      }

      placed.add(e.group)

      return [group]
    })
  }

  const opened = (event: Occurrence) =>
    panel.openEvent?.id === event.id && panel.openEvent.start === event.start

  let dragged = $state<Occurrence | null>(null)
  let over = $state<{ key: string; zone: Zone } | null>(null)

  const zoneOf = (e: DragEvent, event: Occurrence): Zone => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const at = (e.clientY - box.top) / box.height
    const sortable = !ranged && event.allDay && dragged?.allDay

    if (sortable && at < 0.3) {
      return "before"
    }

    return sortable && at > 0.7 ? "after" : "group"
  }

  const onDragOver = (e: DragEvent, event: Occurrence) => {
    if (!dragged || keyOf(dragged) === keyOf(event)) {
      return
    }

    e.preventDefault()
    over = { key: keyOf(event), zone: zoneOf(e, event) }
  }

  const onDrop = async (e: DragEvent, event: Occurrence) => {
    e.preventDefault()

    const moved = dragged
    const zone = over?.zone

    reset()

    if (!moved || !zone) {
      return
    }

    if (zone === "group") {
      await panel.groupWith(moved, event)
    } else {
      await panel.reorderDay(moved.id, event.id, zone === "after")
    }
  }

  const reset = () => {
    dragged = null
    over = null
  }
</script>

<section
  class="flex h-full min-h-0 flex-col"
  aria-label={$t("panel.day.title", { values: { date: heading } })}
>
  <header class="flex items-center justify-between gap-2 border-b border-base-300 py-1.5 pr-2 pl-4">
    <h2 class="truncate text-sm font-semibold tracking-tight">
      {heading}

      {#if weekday}
        <span class="ml-1 text-xs font-normal text-base-content/60">
          {weekday}
        </span>
      {/if}
    </h2>

    <button
      type="button"
      class="btn btn-ghost btn-square btn-xs shrink-0"
      aria-label={$t("panel.day.add")}
      onclick={panel.startNew}
    >
      <Icon icon="lucide:plus" class="size-4" />
    </button>
  </header>

  {#snippet holidayRow(name: string, offDay: boolean)}
    <li class="flex items-stretch gap-1">
      <span class="w-5 shrink-0"></span>

      <span
        class="mt-2 w-11 shrink-0 text-2xs leading-5 font-medium text-base-content/70"
      >
        {$t("panel.allDay")}
      </span>

      <span class="mt-2 flex h-5 w-4 shrink-0 items-center">
        <Icon
          icon="lucide:flag"
          class={["size-3", offDay ? "text-error" : "text-base-content/50"]}
        />
      </span>

      <span
        class={[
          "min-w-0 flex-1 py-2 pr-9 text-sm font-medium break-words",
          offDay && "text-error",
        ]}
        title={$t("panel.holiday")}
      >
        {name}
      </span>
    </li>
  {/snippet}

  {#snippet row(event: Occurrence)}
    {@const parent = panel.parentOf(event)?.title}
    {@const labels = labelsOf(event)}
    {@const done = isDone(event)}
    {@const target = over?.key === keyOf(event) ? over.zone : null}
    <li
      class={["group relative", dragged && keyOf(dragged) === keyOf(event) && "opacity-40"]}
      draggable="true"
      ondragstart={e => {
        dragged = event

        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move"
        }
      }}
      ondragover={e => onDragOver(e, event)}
      ondragleave={() => (over = null)}
      ondrop={e => onDrop(e, event)}
      ondragend={reset}
    >
      {#if target === "before" || target === "after"}
        <span class={["drop-line", target === "after" && "is-after"]}></span>
      {/if}

      <div
        class={[
          "flex items-stretch gap-1 rounded-field transition-colors duration-120",
          "has-focus-visible:ring-2 has-focus-visible:ring-primary/50",
          opened(event)
            ? "bg-primary/10 ring-1 ring-primary/40"
            : "hover:bg-base-content/5",
          target === "group" && "ring-2 ring-primary/60",
        ]}
      >
        <span
          class={[
            "flex w-5 shrink-0 cursor-grab items-center justify-center",
            "text-base-content/25 transition-colors group-hover:text-base-content/45",
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
            <span class="leading-5 font-medium">{$t("panel.allDay")}</span>
          {:else}
            <span class="leading-5 font-medium">{clock(event.start)}</span>
            {#if !openEnded(event)}
              <span class="text-base-content/50">{clock(event.end)}</span>
            {/if}
          {/if}
        </span>

        <span class="mt-2 flex h-5 w-4 shrink-0 items-center">
          {#if event.task}
            <input
              type="checkbox"
              class="checkbox checkbox-primary checkbox-xs"
              checked={done}
              aria-label={$t(done ? "panel.task.undo" : "panel.task.done")}
              onchange={() => panel.toggleDone(event)}
            />
          {:else}
            <span class={["size-2 rounded-full", panel.dotTone(event)]}></span>
          {/if}
        </span>

        <button
          type="button"
          class="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 py-2 pr-9 text-left outline-none"
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

  {#snippet list(events: Occurrence[])}
    {#each clusters(events) as members (keyOf(members[0]))}
      {#if members.length === 1}
        {@render row(members[0])}
      {:else}
        <li
          class={[
            "my-0.5 rounded-box border border-primary/25 bg-primary/5",
            "transition-colors duration-120 hover:border-primary/50 hover:bg-primary/10",
          ]}
          aria-label={$t("panel.group.title")}
        >
          <ul class="flex flex-col">
            {#each members as event (keyOf(event))}
              {@render row(event)}
            {/each}
          </ul>
        </li>
      {/if}
    {/each}
  {/snippet}

  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    {#if empty}
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
      {#each sections as { day, events: visible } (day.getTime())}
        {@const holidays = panel.holidayFor(day)}
        {@const hidden = panel.hiddenOn(day)}
        {@const revealed = panel.isRevealed(day)}
        {@const events = revealed ? [...visible, ...hidden] : visible}
        {@const allDay = events.filter(e => e.allDay)}
        {@const timed = events.filter(e => !e.allDay)}

        {#if ranged && holidays.length + events.length > 0}
          <h3 class="px-2 pt-2 pb-1 text-2xs font-semibold text-base-content/55">
            {shortDay(day)}
          </h3>
        {/if}

        {#if holidays.length + allDay.length > 0}
          <ul class="flex flex-col">
            {#each holidays as name (name)}
              {@render holidayRow(name, panel.isHoliday(day))}
            {/each}

            {@render list(allDay)}
          </ul>
        {/if}

        {#if holidays.length + allDay.length > 0 && timed.length > 0}
          <div class="my-1.5 border-t border-base-300/70"></div>
        {/if}

        {#if timed.length > 0}
          <ul class="flex flex-col">
            {@render list(timed)}
          </ul>
        {/if}

        {#if hidden.length > 0}
          <button
            type="button"
            class={[
              "mt-0.5 flex w-full cursor-pointer items-center gap-1.5 rounded-field py-1 pr-2 pl-7",
              "text-2xs text-base-content/50 transition-colors duration-120",
              "hover:bg-base-content/5 hover:text-base-content/70",
            ]}
            aria-expanded={revealed}
            onclick={() => panel.toggleReveal(day)}
          >
            <Icon icon={revealed ? "lucide:eye" : "lucide:eye-off"} class="size-3" />
            {$t(revealed ? "panel.hideAgain" : "panel.hiddenCount", {
              values: { count: hidden.length },
            })}
            <Icon
              icon="lucide:chevron-down"
              class={["ml-auto size-3 transition-transform", revealed && "rotate-180"]}
            />
          </button>
        {/if}
      {/each}
    {/if}
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
