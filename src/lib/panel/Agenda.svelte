<script lang="ts">
  import Icon from "@iconify/svelte"
  import { formatRange } from "$lib/data/calendar"
  import type { CalendarEvent, Todo } from "$lib/data/types"
  import TodoItem from "./TodoItem.svelte"

  type Props = {
    title?: string
    events: CalendarEvent[]
    todos?: Todo[]
    empty?: string
    now?: Date
    onedit: (event: CalendarEvent) => void
  }

  let {
    title,
    events,
    todos = [],
    empty,
    now = new Date(),
    onedit,
  }: Props = $props()
</script>

<section class="flex flex-col gap-1">
  {#if title}
    <h3
      class="px-2 text-[11px] font-semibold tracking-wide text-base-content/50"
    >
      {title}
    </h3>
  {/if}

  {#if events.length === 0 && todos.length === 0 && empty}
    <p class="px-2 py-2 text-sm text-base-content/45">{empty}</p>
  {/if}

  {#if events.length > 0}
    <ul class="flex flex-col gap-0.5">
      {#each events as event (`${event.id}@${event.start}`)}
        <li>
          <button
            class="flex w-full items-center gap-2.5 rounded-field px-2 py-1.5 text-left transition-colors duration-150 hover:bg-base-content/5"
            onclick={() => onedit(event)}
          >
            <span
              class="h-8 w-1 shrink-0 rounded-full"
              style:background={event.color ?? "var(--color-primary)"}
            ></span>

            <span class="flex min-w-0 grow flex-col">
              <span class="truncate text-sm leading-5">{event.title}</span>

              <span class="text-[11px] text-base-content/60 tabular-nums">
                {formatRange(event)}
              </span>
            </span>

            {#if event.recurrence !== "none"}
              <Icon
                icon="lucide:repeat"
                class="size-3.5 shrink-0 text-base-content/40"
              />
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if todos.length > 0}
    <ul class="flex flex-col gap-0.5">
      {#each todos as todo (todo.id)}
        <TodoItem {todo} {now} />
      {/each}
    </ul>
  {/if}
</section>
