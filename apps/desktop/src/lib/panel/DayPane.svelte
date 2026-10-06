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

  const holidays = $derived(panel.holidayFor(day))

  const labelsOf = (event: CalendarEvent) =>
    tagsOf(panel.profile.calendar.tags, event).map(tagLabel)

  const heading = $derived(
    day.toLocaleDateString(currentLocale(), { month: "long", day: "numeric" }),
  )

  const weekday = $derived(
    day.toLocaleDateString(currentLocale(), { weekday: "long" }),
  )
</script>

<section
  class="flex h-full min-h-0 flex-col"
  aria-label={$t("panel.day.title", { values: { date: heading } })}
>
  <header
    class={[
      "flex min-h-14 flex-col justify-center",
      "border-b border-base-300 px-4 py-3",
    ]}
  >
    <div class="flex items-center justify-between gap-2">
      <h2 class="truncate text-base font-semibold tracking-tight">
        {heading}
        <span class="ml-1 font-normal text-base-content/60">{weekday}</span>
      </h2>

      {#if events.length > 0}
        <span class="badge badge-ghost badge-sm shrink-0 tabular-nums">
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
      <ul class="flex flex-col gap-0.5">
        {#each events as event (event.id + event.start)}
          {@const meta = colorMeta[toColor(event.color)]}
          {@const parent = panel.parentOf(event)?.title}
          {@const labels = labelsOf(event)}
          {@const done = isDone(event)}
          <li class="group relative">
            <button
              type="button"
              class={[
                "flex w-full cursor-pointer items-start gap-3 rounded-field",
                "py-2 pr-10 pl-2.5 text-left outline-none",
                "transition-colors duration-120 hover:bg-base-content/5",
                "focus-visible:ring-2 focus-visible:ring-primary/50",
              ]}
              onclick={() => panel.show(event)}
            >
              <span
                class={[
                  "flex w-12 shrink-0 flex-col pt-0.5 text-2xs tabular-nums",
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

              {#if event.task}
                <span class="size-4 shrink-0"></span>
              {:else}
                <span class={["mt-1.5 size-2 shrink-0 rounded-full", meta.chip]}
                ></span>
              {/if}

              <span class="flex min-w-0 flex-1 flex-col">
                <span
                  class={[
                    "line-clamp-2 text-sm font-medium break-words",
                    done && "text-base-content/50 line-through",
                  ]}
                >
                  {event.title}
                </span>

                {#if event.shiftedFrom}
                  <span class="mt-0.5 text-2xs text-warning">
                    {$t("panel.event.movedFrom", {
                      values: { date: shortDay(parseLocal(event.shiftedFrom)) },
                    })}
                  </span>
                {/if}

                {#if parent || labels.length > 0}
                  <span
                    class={[
                      "mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5",
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
              </span>
            </button>

            {#if event.task}
              <input
                type="checkbox"
                class="checkbox checkbox-primary checkbox-xs absolute top-2 left-17.5"
                checked={done}
                aria-label={$t(done ? "panel.task.undo" : "panel.task.done")}
                onchange={() => panel.toggleDone(event)}
              />
            {/if}

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
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="flex flex-col border-t border-base-300 p-2">
    <button
      class="btn btn-sm btn-ghost justify-start"
      onclick={panel.startNew}
    >
      <Icon icon="lucide:plus" class="size-3.5" />
      {$t("panel.day.add")}
    </button>
  </div>
</section>
