<script lang="ts">
  import Icon from "@iconify/svelte"
  import { todos } from "$lib/data/store"
  import type { CalendarEvent, Todo } from "$lib/data/types"
  import { colorMeta, toColor } from "./colors"
  import { eventTime } from "./format"

  const {
    day,
    events,
    dayTodos,
    openEvent,
    removeEvent,
    startNew,
    openDay,
  }: {
    day: Date
    events: CalendarEvent[]
    dayTodos: Todo[]
    openEvent: (event: CalendarEvent) => void
    removeEvent: (event: CalendarEvent) => void
    startNew: () => void
    openDay: () => void
  } = $props()

  const heading = $derived(
    day.toLocaleDateString("ko-KR", { month: "long", day: "numeric" }),
  )

  const toggle = (todo: Todo) =>
    todos.put({
      ...todo,
      done: !todo.done,
      doneAt: todo.done ? null : Date.now(),
    })
</script>

<div class="flex h-full min-h-0 flex-col">
  <header class="border-b border-base-300 px-4 py-3">
    <div class="text-[0.6875rem] tracking-wider text-base-content/55">
      {heading} 일정
    </div>
    <div class="mt-0.5 text-[0.8125rem] font-semibold">
      일정 {events.length}개 · 할 일 {dayTodos.length}개
    </div>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
    {#if events.length === 0 && dayTodos.length === 0}
      <div class="px-3 py-8 text-center text-xs text-base-content/50">
        일정 없음
        <button
          class="mt-2 block w-full cursor-pointer text-xs font-medium text-primary hover:underline"
          onclick={startNew}
        >
          새 일정 추가
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
                {eventTime(event)}
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
            aria-label="일정 삭제"
            onclick={() => removeEvent(event)}
          >
            <Icon icon="lucide:trash-2" class="size-3" />
          </button>
        </li>
      {/each}

      {#each dayTodos as todo (todo.id)}
        <li class="flex items-start gap-2.5 rounded-md px-2.5 py-2">
          <input
            type="checkbox"
            class="checkbox checkbox-xs checkbox-primary mt-1"
            checked={todo.done}
            onchange={() => toggle(todo)}
          />

          <div class="min-w-0 flex-1">
            <div
              class={[
                "truncate text-[0.8125rem]",
                todo.done && "line-through opacity-50",
              ]}
            >
              {todo.title}
            </div>
            <div class="mt-0.5 text-[0.6875rem] text-base-content/55">할 일</div>
          </div>
        </li>
      {/each}
    </ul>
  </div>

  <div class="flex flex-col border-t border-base-300 px-3 py-2">
    <button class="btn btn-sm btn-ghost justify-start" onclick={startNew}>
      <Icon icon="lucide:plus" class="size-3.5" />
      새 일정 추가
    </button>

    <button class="btn btn-sm btn-ghost justify-start" onclick={openDay}>
      <Icon icon="lucide:list-checks" class="size-3.5" />
      이 날짜 할 일 보기
    </button>
  </div>
</div>
