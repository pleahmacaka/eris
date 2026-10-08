<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { Aura } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { longDay } from "$lib/calendar"
  import { dateKey, isDone } from "$lib/data"
  import type { Morph } from "./morph.svelte"
  import type { Panel } from "./panel.svelte"
  import PanelAside from "./PanelAside.svelte"

  const DOTS = 3

  const { panel, morph }: { panel: Panel; morph: Morph } = $props()

  const weekdays = $derived(
    panel.weeks[0].map(day =>
      day.toLocaleDateString(currentLocale(), { weekday: "narrow" }),
    ),
  )

  const todayKey = $derived(dateKey(panel.today))

  const selectedKey = $derived(dateKey(panel.selected))
</script>

<svelte:window onpointerup={panel.endDrag} onblur={panel.endDrag} />

<div class="grid w-[48rem] grid-cols-12 gap-3">
  <section
    {@attach morph.monthCard}
    class="panel-surface col-span-7 flex flex-col"
    aria-label={$t("panel.calendarAria")}
  >
    <Aura />

    <header class="flex min-h-14 items-center justify-between gap-3 px-4 pt-3 pb-1">
      <div class="min-w-0">
        <h2 class="truncate text-base font-semibold tracking-tight tabular-nums">
          {panel.monthLabel}
        </h2>
        <p class="text-2xs tabular-nums text-base-content/55">
          {$t("panel.header.today", { values: { date: dateKey(panel.today) } })}
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-1">

        <div class="join">
          <button
            class="join-item btn btn-xs btn-ghost btn-square"
            aria-label={$t("common.previous")}
            onclick={() => panel.shift(-1)}
          >
            <Icon icon="lucide:chevron-left" class="size-3.5" />
          </button>

          <button class="join-item btn btn-xs btn-ghost" onclick={panel.jumpToday}>
            {$t("dates.today")}
          </button>

          <button
            class="join-item btn btn-xs btn-ghost btn-square"
            aria-label={$t("common.next")}
            onclick={() => panel.shift(1)}
          >
            <Icon icon="lucide:chevron-right" class="size-3.5" />
          </button>
        </div>

        <button
          class={["btn btn-ghost btn-square btn-xs", panel.view.kind === "notes" && "btn-active"]}
          aria-label={$t("panel.notesAria")}
          aria-pressed={panel.view.kind === "notes"}
          onclick={panel.showNotes}
        >
          <Icon icon="lucide:sticky-note" class="size-3.5" />
        </button>

        <button
          class="btn btn-ghost btn-square btn-xs"
          aria-label={$t("panel.expand")}
          onclick={morph.expand}
        >
          <Icon icon="lucide:maximize-2" class="size-3.5" />
        </button>
      </div>
    </header>

    <div class="flex flex-col px-2 pb-2">
      <div class="grid grid-cols-7 gap-1">
        {#each weekdays as weekday, index (index)}
          <span
            class={[
              "py-2 text-center text-2xs font-medium",
              panel.weekdayTone(panel.weeks[0][index]) ?? "text-base-content/45",
            ]}
          >
            {weekday}
          </span>
        {/each}
      </div>

      <div class="grid grid-cols-7 grid-rows-6 gap-1">
        {#each panel.weeks as week (dateKey(week[0]))}
          {#each week as day (dateKey(day))}
            {@const outside = day.getMonth() !== panel.month}
            {@const isToday = dateKey(day) === todayKey}
            {@const isSelected = dateKey(day) === selectedKey}
            {@const dayEvents = panel.eventsOn(day)}
            <button
              type="button"
              class={[
                "flex h-14 cursor-pointer flex-col items-center gap-1.5 rounded-xl pt-2",
                "outline-none transition-colors duration-120",
                "focus-visible:ring-2 focus-visible:ring-primary/50",
                outside && "*:opacity-40",
                panel.rangeTone(day),
                isSelected
                  ? "bg-base-content/8"
                  : !panel.inRange(day) && "hover:bg-base-content/5",
              ]}
              aria-current={isToday ? "date" : undefined}
              aria-pressed={isSelected}
              aria-label={[longDay(day), ...panel.holidayFor(day)].join(", ")}
              onclick={() => panel.pick(day)}
              onpointerdown={e => e.button === 0 && panel.beginDrag(day)}
              onpointerenter={() => panel.extendDrag(day)}
            >
              <span
                class={[
                  "grid size-7 place-items-center rounded-lg text-sm tabular-nums",
                  isToday
                    ? "bg-primary font-semibold text-primary-content"
                    : ["font-medium", panel.dayTone(day)],
                ]}
              >
                {day.getDate()}
              </span>

              <span class="flex h-2 items-center gap-1">
                {#each dayEvents.slice(0, DOTS) as event (event.id + event.start)}
                  <span
                    class={[
                      "size-1.5 rounded-full",
                      panel.dotTone(event),
                      isDone(event) && "opacity-30",
                    ]}
                  ></span>
                {/each}
              </span>
            </button>
          {/each}
        {/each}
      </div>
    </div>
  </section>

  <div {@attach morph.card} class="relative col-span-5">
    <div class="absolute inset-0 flex">
      <PanelAside {panel} />
    </div>
  </div>
</div>
