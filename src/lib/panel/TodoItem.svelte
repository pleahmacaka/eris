<script lang="ts">
  import Icon from "@iconify/svelte"
  import { todos } from "$lib/data/store"
  import { dueLabel, isOverdue } from "$lib/data/todo"
  import type { Todo } from "$lib/data/types"

  type Props = {
    todo: Todo
    now?: Date
    draggable?: boolean
    dragging?: boolean
    over?: boolean
    ondragstart?: () => void
    ondragover?: () => void
    ondrop?: () => void
    ondragend?: () => void
  }

  let {
    todo,
    now = new Date(),
    draggable = false,
    dragging = false,
    over = false,
    ondragstart,
    ondragover,
    ondrop,
    ondragend,
  }: Props = $props()

  const PRIORITY_TONE: Record<number, string> = {
    1: "badge-error",
    2: "badge-warning",
    3: "badge-info",
  }

  let editing = $state(false)
  let draft = $state("")
  let field = $state<HTMLInputElement>()

  const overdue = $derived(isOverdue(todo, now))
  const due = $derived(dueLabel(todo, now))
  const hasMeta = $derived(
    due !== "" || todo.tags.length > 0 || todo.priority > 0,
  )

  $effect(() => {
    if (editing && field) {
      field.focus()
      field.select()
    }
  })

  const toggle = () =>
    todos.put({
      ...todo,
      done: !todo.done,
      doneAt: todo.done ? null : Date.now(),
    })

  const remove = () => todos.remove(todo.id)

  const startEdit = () => {
    draft = todo.title
    editing = true
  }

  const commit = () => {
    const title = draft.trim()

    editing = false

    if (title && title !== todo.title) {
      todos.put({ ...todo, title })
    }
  }

  const onEditKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      commit()
    } else if (e.key === "Escape") {
      e.stopPropagation()
      editing = false
    }
  }

  const onTitleKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault()
      startEdit()
    }
  }

  const dragStart = (e: DragEvent) => {
    e.dataTransfer?.setData("text/plain", todo.id)

    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"
    }

    ondragstart?.()
  }

  const dragOver = (e: DragEvent) => {
    if (!draggable) {
      return
    }

    e.preventDefault()
    ondragover?.()
  }

  const drop = (e: DragEvent) => {
    e.preventDefault()
    ondrop?.()
  }
</script>

<li
  class={[
    "group flex items-start gap-2.5 rounded-field px-2 py-1.5 transition-colors duration-150 hover:bg-base-content/5",
    dragging && "opacity-40",
    over && "ring-1 ring-primary/50",
    todo.done && "opacity-60",
  ]}
  ondragover={dragOver}
  ondragenter={dragOver}
  ondrop={drop}
  {ondragend}
>
  {#if draggable}
    <span
      class="mt-0.5 shrink-0 cursor-grab text-base-content/0 transition-colors duration-150 group-hover:text-base-content/40"
      aria-hidden="true"
      draggable="true"
      ondragstart={dragStart}
    >
      <Icon icon="lucide:grip-vertical" class="size-4" />
    </span>
  {/if}

  <input
    type="checkbox"
    class="checkbox checkbox-sm checkbox-primary mt-0.5 rounded-full"
    checked={todo.done}
    onchange={toggle}
    aria-label={todo.done ? "Mark as not done" : "Mark as done"}
  />

  <div class="flex min-w-0 grow flex-col gap-0.5">
    {#if editing}
      <input
        bind:this={field}
        bind:value={draft}
        type="text"
        class="input input-xs w-full"
        aria-label="Todo title"
        onblur={commit}
        onkeydown={onEditKey}
      />
    {:else}
      <button
        type="button"
        class={[
          "w-full truncate text-left text-sm leading-5",
          todo.done && "line-through",
        ]}
        title="Double-click to edit"
        ondblclick={startEdit}
        onkeydown={onTitleKey}
      >
        {todo.title}
      </button>
    {/if}

    {#if hasMeta}
      <div
        class="flex flex-wrap items-center gap-1 text-[11px] text-base-content/60"
      >
        {#if todo.priority}
          <span class={["badge badge-xs badge-soft", PRIORITY_TONE[todo.priority]]}>
            !{todo.priority}
          </span>
        {/if}

        {#if due}
          <span
            class={["flex items-center gap-0.5", overdue && "text-error"]}
          >
            <Icon icon="lucide:calendar" class="size-3" />

            {due}
          </span>
        {/if}

        {#each todo.tags as tag (tag)}
          <span class="badge badge-ghost badge-xs">#{tag}</span>
        {/each}
      </div>
    {/if}
  </div>

  <button
    class="btn btn-ghost btn-square btn-xs shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
    aria-label="Delete todo"
    onclick={remove}
  >
    <Icon icon="lucide:x" class="size-3.5" />
  </button>
</li>
