<script lang="ts">
  import Icon from "@iconify/svelte"
  import { dueLabel, isOverdue } from "$lib/data/todo"
  import { todos } from "$lib/data/store"
  import type { Priority, Todo } from "$lib/data/types"

  const { todo }: { todo: Todo } = $props()

  let editing = $state(false)
  let draft = $state("")

  const overdue = $derived(isOverdue(todo))

  const due = $derived(dueLabel(todo))

  const TONE: Record<Priority, string> = {
    0: "",
    1: "text-info",
    2: "text-warning",
    3: "text-error",
  }

  const toggle = () =>
    todos.put({
      ...todo,
      done: !todo.done,
      doneAt: todo.done ? null : Date.now(),
    })

  const commit = () => {
    editing = false

    if (draft.trim() && draft !== todo.title) {
      todos.put({ ...todo, title: draft.trim() })
    } else {
      draft = todo.title
    }
  }

  const startEdit = () => {
    draft = todo.title
    editing = true
  }

  const cycle = () =>
    todos.put({ ...todo, priority: (((todo.priority + 1) % 4) as Priority) })
</script>

<li
  class={[
    "flex items-center gap-3 border border-base-content/10 bg-base-100",
    "px-3 py-2.5 transition-opacity",
    todo.done && "opacity-45",
  ]}
>
  <input
    type="checkbox"
    class="checkbox checkbox-sm checkbox-primary shrink-0"
    checked={todo.done}
    onchange={toggle}
  />

  <div class="min-w-0 flex-1">
    {#if editing}
      <input
        class="w-full bg-transparent outline-none"
        bind:value={draft}
        onblur={commit}
        onkeydown={e => e.key === "Enter" && commit()}
      />
    {:else}
      <button
        class="w-full cursor-text truncate text-left"
        ondblclick={startEdit}
        onclick={toggle}
      >
        <span class={{ "line-through": todo.done }}>{todo.title}</span>
      </button>
    {/if}

    <div class="flex items-center gap-2 text-xs">
      {#if due}
        <span class={overdue ? "text-error" : "text-base-content/50"}>
          {due}
        </span>
      {/if}

      {#each todo.tags as tag (tag)}
        <span class="text-base-content/40">#{tag}</span>
      {/each}
    </div>
  </div>

  <button
    class={["btn btn-ghost btn-square btn-sm shrink-0", TONE[todo.priority]]}
    aria-label="중요도"
    onclick={cycle}
  >
    <Icon
      icon={todo.priority > 0 ? "lucide:flag" : "lucide:flag-off"}
      class="size-4"
    />
  </button>

  <button
    class="btn btn-ghost btn-square btn-sm shrink-0 text-base-content/40"
    aria-label="삭제"
    onclick={() => todos.remove(todo.id)}
  >
    <Icon icon="lucide:x" class="size-4" />
  </button>
</li>
