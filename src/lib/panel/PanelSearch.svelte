<script lang="ts">
  import Icon from "@iconify/svelte"
  import { formatRange, parseLocal } from "$lib/data/calendar"
  import type { CalendarEvent, Todo } from "$lib/data/types"
  import { score } from "$lib/launcher/search"
  import { dayLabel } from "./dates"
  import TodoItem from "./TodoItem.svelte"

  type Props = {
    events: CalendarEvent[]
    todos: Todo[]
    query: string
    now: Date
    onedit: (event: CalendarEvent) => void
  }

  let { events, todos, query, now, onedit }: Props = $props()

  const LIMIT = 20

  let todoList = $state<HTMLUListElement>()

  const rate = (needle: string, ...fields: string[]) =>
    Math.max(
      ...fields.map((text, index) => score(text, needle) * (index ? 0.6 : 1)),
    )

  const rank = <T,>(items: T[], of: (item: T) => number) =>
    items
      .map(item => ({ item, hit: of(item) }))
      .filter(entry => entry.hit > 0)
      .sort((a, b) => b.hit - a.hit)
      .slice(0, LIMIT)

  const eventHits = $derived(
    rank(events, event => rate(query, event.title, event.notes)),
  )

  const todoHits = $derived(
    rank(todos, todo =>
      rate(query, todo.title, todo.notes, todo.tags.join(" ")),
    ),
  )

  export const openFirst = () => {
    const [event] = eventHits
    const [todo] = todoHits

    if (event && (!todo || event.hit >= todo.hit)) {
      onedit(event.item)

      return
    }

    todoList?.querySelector("button")?.focus()
  }
</script>

<div class="flex flex-col gap-4">
  {#if eventHits.length > 0}
    <section class="flex flex-col gap-1">
      <h3
        class="flex items-center gap-2 px-2 text-[11px] font-semibold tracking-wide text-base-content/50"
      >
        Events

        <span class="badge badge-ghost badge-xs tabular-nums">
          {eventHits.length}
        </span>
      </h3>

      <ul class="flex flex-col gap-0.5">
        {#each eventHits as { item: event } (event.id)}
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
                  {dayLabel(parseLocal(event.start), now)} · {formatRange(event)}
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
    </section>
  {/if}

  {#if todoHits.length > 0}
    <section class="flex flex-col gap-1">
      <h3
        class="flex items-center gap-2 px-2 text-[11px] font-semibold tracking-wide text-base-content/50"
      >
        Todos

        <span class="badge badge-ghost badge-xs tabular-nums">
          {todoHits.length}
        </span>
      </h3>

      <ul bind:this={todoList} class="flex flex-col gap-0.5">
        {#each todoHits as { item: todo } (todo.id)}
          <TodoItem {todo} {now} />
        {/each}
      </ul>
    </section>
  {/if}

  {#if eventHits.length === 0 && todoHits.length === 0}
    <p
      class="flex flex-col items-center gap-2 px-2 py-8 text-center text-sm text-base-content/50"
    >
      <Icon icon="lucide:search-x" class="size-6 text-base-content/40" />

      No matches
    </p>
  {/if}
</div>
