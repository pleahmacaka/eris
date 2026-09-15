<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import type { CalendarEvent } from "$lib/data"
  import { colorMeta, toColor } from "./colors"
  import { eventTime } from "./format"

  const {
    day,
    events,
    holidays,
    openEvent,
    removeEvent,
    startNew,
  }: {
    day: Date
    events: CalendarEvent[]
    holidays: string[]
    openEvent: (event: CalendarEvent) => void
    removeEvent: (event: CalendarEvent) => void
    startNew: () => void
  } = $props()

  const heading = $derived(
    day.toLocaleDateString(currentLocale(), { month: "long", day: "numeric" }),
  )
</script>

<div class="flex h-full min-h-0 flex-col">
  <header class="border-b border-base-300 px-4 py-3">
    <div class="text-[0.6875rem] tracking-wider text-base-content/55">
      {$t("panel.day.title", { values: { date: heading } })}
    </div>
    <div class="mt-0.5 text-[0.8125rem] font-semibold">
      {$t("panel.day.count", { values: { count: events.length } })}
    </div>

    {#each holidays as name (name)}
      <div class="mt-1 truncate text-[0.6875rem] font-medium text-error">
        {name}
      </div>
    {/each}
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
    {#if events.length === 0}
      <div class="px-3 py-8 text-center text-xs text-base-content/50">
        {$t("panel.day.empty")}
        <button
          class="mt-2 block w-full cursor-pointer text-xs font-medium text-primary hover:underline"
          onclick={startNew}
        >
          {$t("panel.day.add")}
        </button>
      </div>
    {/if}

    <ul>
      {#each events as event (event.id + event.start)}
        {@const meta = colorMeta[toColor(event.color)]}
        <li class="group relative">
          <button
            type="button"
            class={[
              "flex w-full cursor-pointer items-start gap-2.5 rounded-md",
              "px-2.5 py-2 text-left transition-colors hover:bg-base-200/60",
            ]}
            onclick={() => openEvent(event)}
          >
            <span class={["mt-1.5 size-2 shrink-0 rounded-full", meta.chip]}
            ></span>

            <div class="min-w-0 flex-1">
              <div class="truncate text-[0.8125rem] font-medium">
                {event.title}
              </div>
              <div class="tabular mt-0.5 text-[0.6875rem] text-base-content/55">
                {eventTime(event, $t("panel.allDay"))}
              </div>
            </div>
          </button>

          <button
            type="button"
            class={[
              "absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2",
              "cursor-pointer place-items-center rounded text-base-content/45",
              "opacity-0 transition-opacity hover:bg-base-300 hover:text-error",
              "group-hover:opacity-100",
            ]}
            aria-label={$t("common.delete")}
            onclick={() => removeEvent(event)}
          >
            <Icon icon="lucide:trash-2" class="size-3" />
          </button>
        </li>
      {/each}
    </ul>
  </div>

  <div class="flex flex-col border-t border-base-300 px-3 py-2">
    <button class="btn btn-sm btn-ghost justify-start" onclick={startNew}>
      <Icon icon="lucide:plus" class="size-3.5" />
      {$t("panel.day.add")}
    </button>
  </div>
</div>
