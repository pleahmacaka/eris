<script lang="ts">
  import Icon from "@iconify/svelte"
  import { currentLocale } from "@eris/i18n"
  import { t } from "svelte-i18n"
  import { eventSpan } from "$lib/calendar"
  import { dateKey, notePreview, noteTitle } from "$lib/data"
  import { colorMeta, toColor } from "./colors"
  import type { Morph } from "./morph.svelte"
  import type { Panel } from "./panel.svelte"

  const AGENDA = 3

  const { panel, morph }: { panel: Panel; morph: Morph } = $props()

  let draft = $state("")

  const rows = $derived(
    panel.weeks.filter(week => week.some(day => day.getMonth() === panel.month)),
  )

  const weekdays = $derived(
    panel.weeks[0].map(day =>
      day.toLocaleDateString(currentLocale(), { weekday: "narrow" }),
    ),
  )

  const todayKey = $derived(dateKey(panel.today))
  const selectedKey = $derived(dateKey(panel.selected))
  const dayEvents = $derived(panel.dayEvents)
  const note = $derived(panel.latestNote)

  const selectedLabel = $derived(
    panel.selected.toLocaleDateString(currentLocale(), {
      month: "long",
      day: "numeric",
      weekday: "long",
    }),
  )

  const submitTodo = () => {
    const text = draft.trim()

    if (text) {
      panel.addTodo(text)
      draft = ""
    }
  }
</script>

<div class="grid w-[44rem] grid-cols-12 gap-3">
  <section
    {@attach morph.monthCard}
    class="eris-card col-span-7 flex flex-col p-4"
    aria-label={$t("panel.calendarAria")}
  >
    <header class="mb-3 flex items-center justify-between gap-2">
      <h2 class="truncate text-base font-semibold tabular-nums">
        {panel.monthLabel}
      </h2>

      <div class="flex shrink-0 items-center text-base-content/55">
        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          aria-label={$t("common.previous")}
          onclick={() => panel.shift(-1)}
        >
          <Icon icon="lucide:chevron-left" class="size-4" />
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          aria-label={$t("common.next")}
          onclick={() => panel.shift(1)}
        >
          <Icon icon="lucide:chevron-right" class="size-4" />
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-square btn-sm"
          aria-label={$t("panel.expand")}
          onclick={morph.expand}
        >
          <Icon icon="lucide:maximize-2" class="size-4" />
        </button>
      </div>
    </header>

    <div class="grid grid-cols-7 gap-y-1 text-center text-sm tabular-nums">
      {#each weekdays as weekday, index (index)}
        <span class="pb-1 text-xs text-base-content/45">{weekday}</span>
      {/each}

      {#each rows as week (dateKey(week[0]))}
        {#each week as day (dateKey(day))}
          {@const inMonth = day.getMonth() === panel.month}
          {@const isToday = dateKey(day) === todayKey}
          {@const isSelected = dateKey(day) === selectedKey}
          <button
            type="button"
            class={[
              "relative mx-auto grid size-10 cursor-pointer place-items-center rounded-xl",
              "outline-none transition-colors duration-120",
              "focus-visible:ring-2 focus-visible:ring-primary/50",
              isToday
                ? "bg-primary font-semibold text-primary-content"
                : isSelected
                  ? "bg-base-content/10 font-semibold"
                  : "hover:bg-base-content/6",
              !inMonth && "invisible",
            ]}
            tabindex={inMonth ? 0 : -1}
            aria-pressed={isSelected}
            aria-label={day.toLocaleDateString(currentLocale(), {
              month: "long",
              day: "numeric",
            })}
            onclick={() => panel.pick(day)}
          >
            {day.getDate()}

            {#if inMonth && panel.eventsOn(day).length > 0}
              <span
                class={[
                  "absolute bottom-1.5 size-1 rounded-full",
                  isToday ? "bg-primary-content" : "bg-primary",
                ]}
              ></span>
            {/if}
          </button>
        {/each}
      {/each}
    </div>

    <div class="mt-3 flex flex-col gap-1.5 border-t border-base-content/10 pt-3">
      <span class="text-xs font-medium text-base-content/55">{selectedLabel}</span>

      {#each dayEvents.slice(0, AGENDA) as event (event.id + event.start)}
        {@const meta = colorMeta[toColor(event.color)]}
        <div class="flex min-w-0 items-center gap-2 text-sm">
          <span class={["size-2 shrink-0 rounded-full", meta.chip]}></span>
          <span class="shrink-0 text-xs tabular-nums text-base-content/60">
            {eventSpan(event, $t("panel.allDay"))}
          </span>
          <span class="min-w-0 truncate font-medium">{event.title}</span>
        </div>
      {:else}
        <span class="text-sm text-base-content/45">{$t("panel.day.empty")}</span>
      {/each}

      {#if dayEvents.length > AGENDA}
        <span class="text-xs tabular-nums text-base-content/50">
          +{dayEvents.length - AGENDA}
        </span>
      {/if}
    </div>
  </section>

  <div class="col-span-5 flex min-h-0 flex-col gap-3">
    <section
      {@attach morph.card}
      class="eris-card flex flex-col gap-2.5 p-4 text-sm"
      aria-label={$t("panel.todoAria")}
    >
      {#each panel.compactTodos as todo (todo.id)}
        <label class="flex min-w-0 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            class="checkbox checkbox-primary checkbox-sm shrink-0"
            checked={todo.done}
            onchange={() => panel.toggleTodo(todo)}
          />

          <span
            class={[
              "min-w-0 flex-1 truncate",
              todo.done && "text-base-content/50 line-through",
            ]}
          >
            {todo.title}
          </span>
        </label>
      {/each}

      <input
        class="input input-sm w-full"
        placeholder={$t("panel.quickAdd.todo")}
        aria-label={$t("panel.todo.titleAria")}
        autocomplete="off"
        spellcheck="false"
        bind:value={draft}
        onkeydown={e => {
          if (e.key === "Enter") {
            submitTodo()
          }
        }}
      />
    </section>

    <section
      {@attach morph.card}
      class="eris-card flex min-h-0 flex-1 flex-col gap-1.5 p-4"
      aria-label={$t("panel.notesAria")}
    >
      <span class="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <Icon icon="lucide:sticky-note" class="size-4 shrink-0 text-accent" />
        <span class="truncate">
          {note ? noteTitle(note) : $t("panel.notes.noNotes")}
        </span>
      </span>

      {#if note && notePreview(note)}
        <span class="line-clamp-6 text-xs leading-relaxed text-base-content/60">
          {notePreview(note)}
        </span>
      {/if}
    </section>
  </div>
</div>
