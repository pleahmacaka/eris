<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import { currentLocale } from "@eris/i18n"
  import type { CalendarEvent } from "$lib/data"
  import { colorMeta, toColor } from "./colors"
  import { clock } from "./format"

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

    {#each holidays as name (name)}
      <p class="mt-1 truncate text-2xs font-medium text-error">{name}</p>
    {/each}
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
          <li class="group relative">
            <button
              type="button"
              class={[
                "flex w-full cursor-pointer items-start gap-3 rounded-field",
                "py-2 pr-10 pl-2.5 text-left outline-none",
                "transition-colors duration-120 hover:bg-base-content/5",
                "focus-visible:ring-2 focus-visible:ring-primary/50",
              ]}
              onclick={() => openEvent(event)}
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
                  <span class="text-base-content/50">{clock(event.end)}</span>
                {/if}
              </span>

              <span class={["mt-1.5 size-2 shrink-0 rounded-full", meta.chip]}
              ></span>

              <span
                class="line-clamp-2 min-w-0 flex-1 text-sm font-medium break-words"
              >
                {event.title}
              </span>
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
              onclick={() => removeEvent(event)}
            >
              <Icon icon="lucide:trash-2" class="size-3.5" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="flex flex-col border-t border-base-300 p-2">
    <button class="btn btn-sm btn-ghost justify-start" onclick={startNew}>
      <Icon icon="lucide:plus" class="size-3.5" />
      {$t("panel.day.add")}
    </button>
  </div>
</section>
