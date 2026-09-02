<script lang="ts">
  import Icon from "@iconify/svelte"
  import { dateKey } from "$lib/data/calendar"
  import { todos } from "$lib/data/store"
  import { isOverdue, sortTodos } from "$lib/data/todo"
  import type { Todo } from "$lib/data/types"
  import type { Profile } from "$lib/settings"
  import QuickAdd from "./QuickAdd.svelte"
  import TodoItem from "./TodoItem.svelte"

  type Props = {
    items: Todo[]
    profile: Profile
    now: Date
  }

  let { items, profile, now }: Props = $props()

  type SectionId = "overdue" | "today" | "upcoming" | "none"

  const SECTIONS: { id: SectionId; label: string }[] = [
    { id: "overdue", label: "Overdue" },
    { id: "today", label: "Today" },
    { id: "upcoming", label: "Upcoming" },
    { id: "none", label: "No date" },
  ]

  let completedOverride = $state<boolean | null>(null)
  let dragId = $state<string | null>(null)
  let overId = $state<string | null>(null)

  const showCompleted = $derived(
    completedOverride ?? profile.todo.showCompleted,
  )

  const manual = $derived(profile.todo.sortBy === "manual")

  const bucket = (todo: Todo, today: string): SectionId => {
    if (!todo.due) {
      return "none"
    }

    if (isOverdue(todo, now)) {
      return "overdue"
    }

    return todo.due.slice(0, 10) === today ? "today" : "upcoming"
  }

  const sorted = $derived(sortTodos(items, profile.todo.sortBy, true))

  const active = $derived(sorted.filter(t => !t.done))

  const done = $derived(sorted.filter(t => t.done))

  const sections = $derived.by(() => {
    const today = dateKey(now)

    return SECTIONS.map(section => ({
      ...section,
      items: active.filter(t => bucket(t, today) === section.id),
    })).filter(section => section.items.length > 0)
  })

  const reset = () => {
    dragId = null
    overId = null
  }

  const drop = async (targetId: string) => {
    const section = sections.find(s => s.items.some(t => t.id === dragId))
    const from = section?.items.findIndex(t => t.id === dragId) ?? -1
    const to = section?.items.findIndex(t => t.id === targetId) ?? -1

    reset()

    if (!section || from < 0 || to < 0 || from === to) {
      return
    }

    const list = [...section.items]
    const [dragged] = list.splice(from, 1)

    list.splice(to, 0, dragged)

    const base = Math.min(...section.items.map(t => t.order))

    for (const [index, todo] of list.entries()) {
      const order = base + index

      if (todo.order !== order) {
        await todos.put({ ...todo, order })
      }
    }
  }

  const clearCompleted = async () => {
    for (const todo of done) {
      await todos.remove(todo.id)
    }
  }
</script>

<div class="flex flex-col gap-4">
  <QuickAdd mode="todo" />

  {#each sections as section (section.id)}
    <section class="flex flex-col gap-1">
      <h3
        class="flex items-center gap-2 px-2 text-[11px] font-semibold tracking-wide text-base-content/50"
      >
        {section.label}

        <span class="badge badge-ghost badge-xs tabular-nums">
          {section.items.length}
        </span>
      </h3>

      <ul class="flex flex-col gap-0.5">
        {#each section.items as todo (todo.id)}
          <TodoItem
            {todo}
            {now}
            draggable={manual}
            dragging={dragId === todo.id}
            over={overId === todo.id && dragId !== todo.id}
            ondragstart={() => {
              dragId = todo.id
            }}
            ondragover={() => {
              overId = todo.id
            }}
            ondrop={() => drop(todo.id)}
            ondragend={reset}
          />
        {/each}
      </ul>
    </section>
  {/each}

  {#if sections.length === 0}
    <p
      class="flex flex-col items-center gap-2 px-2 py-8 text-center text-sm text-base-content/50"
    >
      <Icon icon="lucide:check-circle-2" class="size-6 text-success/70" />

      All done
    </p>
  {/if}

  {#if done.length > 0}
    <section class="flex flex-col gap-1">
      <div class="flex items-center justify-between px-1">
        <button
          class="btn btn-ghost btn-xs gap-1.5 px-1 text-[11px] font-semibold tracking-wide text-base-content/50"
          aria-expanded={showCompleted}
          onclick={() => {
            completedOverride = !showCompleted
          }}
        >
          <Icon
            icon="lucide:chevron-right"
            class={[
              "size-3.5 transition-transform duration-150",
              showCompleted && "rotate-90",
            ]}
          />

          Completed

          <span class="badge badge-ghost badge-xs tabular-nums">
            {done.length}
          </span>
        </button>

        <button class="btn btn-ghost btn-xs" onclick={clearCompleted}>
          Clear completed
        </button>
      </div>

      {#if showCompleted}
        <ul class="flex flex-col gap-0.5">
          {#each done as todo (todo.id)}
            <TodoItem {todo} {now} />
          {/each}
        </ul>
      {/if}
    </section>
  {/if}
</div>
