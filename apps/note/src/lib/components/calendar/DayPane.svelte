<script lang="ts">
  import Icon from "@iconify/svelte"
  import { dateKey } from "$lib/data/calendar"
  import { todos } from "$lib/data/store"
  import type { CalendarEvent, Todo } from "$lib/data/types"
  import { segments } from "$lib/markdown/cite"
  import { colorMeta, toColor } from "./colors"
  import { clock } from "./format"

  const {
    day,
    today,
    events,
    dayTodos,
    openEvent,
    removeEvent,
    startNew,
    openDay,
  }: {
    day: Date
    today: Date
    events: CalendarEvent[]
    dayTodos: Todo[]
    openEvent: (event: CalendarEvent) => void
    removeEvent: (event: CalendarEvent) => void
    startNew: () => void
    openDay: () => void
  } = $props()

  const PRIORITY = ["", "text-info", "text-warning", "text-error"]

  const isToday = $derived(dateKey(day) === dateKey(today))

  const weekday = $derived(
    day.toLocaleDateString("ko-KR", { weekday: "long" }),
  )

  // the first line of the memo, with cited notes reduced to their titles
  const preview = (event: CalendarEvent) =>
    segments(event.notes.split("\n").find(line => line.trim()) ?? "")
      .map(part => ("path" in part ? part.label : part.text))
      .join("")
      .trim()

  const cites = (event: CalendarEvent) =>
    segments(event.notes).filter(part => "path" in part).length

  const toggle = (todo: Todo) =>
    todos.put({
      ...todo,
      done: !todo.done,
      doneAt: todo.done ? null : Date.now(),
    })
</script>

<div class="flex h-full min-h-0 flex-col">
  <header class="flex items-end justify-between gap-3 px-4 pt-4 pb-3">
    <div class="flex items-baseline gap-2">
      <span class="tabular text-3xl font-bold leading-none tracking-tight">
        {day.getDate()}
      </span>
      <span class="text-sm text-base-content/70">
        {day.getMonth() + 1}월 · {weekday}
      </span>
      {#if isToday}
        <span class="badge badge-primary badge-soft badge-sm">오늘</span>
      {/if}
    </div>

    <span class="tabular shrink-0 text-xs text-base-content/50">
      일정 {events.length} · 할 일 {dayTodos.length}
    </span>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
    {#if events.length === 0 && dayTodos.length === 0}
      <div
        class={[
          "mx-2 flex flex-col items-center gap-1 border border-dashed",
          "border-base-content/15 px-3 py-7 text-center",
        ]}
      >
        <Icon icon="lucide:calendar-plus" class="size-5 text-base-content/35" />
        <p class="mt-1 text-sm text-base-content/60">일정 없음</p>
        <button class="btn btn-ghost btn-xs mt-1 text-primary" onclick={startNew}>
          일정 추가
        </button>
      </div>
    {/if}

    <ul class="flex flex-col gap-1">
      {#each events as event (event.id + event.start)}
        {@const meta = colorMeta[toColor(event.color)]}
        {@const memo = preview(event)}
        {@const cited = cites(event)}
        <li class="group relative">
          <button
            type="button"
            class={[
              "flex w-full cursor-pointer items-stretch gap-3 px-2 py-2.5",
              "text-left transition-colors hover:bg-base-content/5",
              "active:bg-base-content/10",
            ]}
            onclick={() => openEvent(event)}
          >
            <span class="tabular flex w-11 shrink-0 flex-col text-xs">
              {#if event.allDay}
                <span class="font-semibold">종일</span>
              {:else}
                <span class="font-semibold">{clock(event.start)}</span>
                <span class="text-base-content/45">{clock(event.end)}</span>
              {/if}
            </span>

            <span class={["w-0.5 shrink-0", meta.chip]}></span>

            <span class="min-w-0 flex-1">
              <span class="line-clamp-2 text-sm font-medium break-keep">
                {event.title}
              </span>

              {#if memo || cited > 0 || event.recurrence !== "none"}
                <span
                  class="mt-1 flex items-center gap-2 text-xs text-base-content/50"
                >
                  {#if event.recurrence !== "none"}
                    <Icon icon="lucide:repeat" class="size-3 shrink-0" />
                  {/if}
                  {#if cited > 0}
                    <span class="flex shrink-0 items-center gap-0.5 text-primary">
                      <Icon icon="lucide:file-text" class="size-3" />
                      {cited}
                    </span>
                  {/if}
                  {#if memo}
                    <span class="min-w-0 truncate">{memo}</span>
                  {/if}
                </span>
              {/if}
            </span>
          </button>

          <button
            type="button"
            class={[
              "absolute right-1.5 top-1/2 hidden size-6 -translate-y-1/2",
              "cursor-pointer place-items-center bg-base-100 text-base-content/45",
              "transition hover:bg-base-content/10 hover:text-error",
              "group-hover:@4xl:grid",
            ]}
            aria-label="일정 삭제"
            onclick={() => removeEvent(event)}
          >
            <Icon icon="lucide:trash-2" class="size-3" />
          </button>
        </li>
      {/each}

      {#each dayTodos as todo (todo.id)}
        <li>
          <label
            class={[
              "flex cursor-pointer items-start gap-3 px-2 py-2.5",
              "transition-colors hover:bg-base-content/5",
            ]}
          >
            <span class="flex w-11 shrink-0 items-center pt-0.5">
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary"
                checked={todo.done}
                onchange={() => toggle(todo)}
              />
            </span>

            <span class="w-0.5 shrink-0 self-stretch bg-base-content/15"></span>

            <span class="min-w-0 flex-1">
              <span
                class={[
                  "line-clamp-2 text-sm break-keep",
                  todo.done && "line-through opacity-50",
                ]}
              >
                {todo.title}
              </span>
              <span class="mt-1 flex items-center gap-2 text-xs text-base-content/50">
                할 일
                {#if todo.priority > 0}
                  <Icon
                    icon="lucide:flag"
                    class={["size-3", PRIORITY[todo.priority]]}
                  />
                {/if}
                {#each todo.tags as tag (tag)}
                  <span>#{tag}</span>
                {/each}
              </span>
            </span>
          </label>
        </li>
      {/each}
    </ul>
  </div>

  <div class="flex flex-col border-t border-base-content/10 px-3 py-2">
    <button
      class="btn btn-sm btn-ghost justify-start @max-2xl:hidden"
      onclick={startNew}
    >
      <Icon icon="lucide:plus" class="size-3.5" />
      새 일정 추가
    </button>

    <button class="btn btn-sm btn-ghost justify-start" onclick={openDay}>
      <Icon icon="lucide:list-checks" class="size-3.5" />
      이 날짜 할 일 보기
    </button>
  </div>
</div>
