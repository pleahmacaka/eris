<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import type { TodoSort } from "@eris/settings"
  import {
    type Todo,
    dueLabel,
    isOverdue,
    newId,
    parseQuickAdd,
    sortTodos,
    todos,
  } from "$lib/data"

  const {
    items,
    sortBy,
    showCompleted,
    back,
  }: {
    items: Todo[]
    sortBy: TodoSort
    showCompleted: boolean
    back: () => void
  } = $props()

  let draft = $state("")
  let editingId = $state<string | null>(null)
  let editDraft = $state("")

  const openCount = $derived(items.filter(todo => !todo.done).length)
  const doneCount = $derived(items.length - openCount)
  const list = $derived(sortTodos(items, sortBy, showCompleted))

  const flagClass = (priority: Todo["priority"]) =>
    priority === 3 ? "text-error" : priority === 2 ? "text-warning" : "text-info"

  const add = async () => {
    const parsed = parseQuickAdd(draft)
    const title = parsed.title?.trim()

    if (!title) {
      return
    }

    const now = Date.now()

    draft = ""

    await todos.put({
      id: newId(),
      title,
      notes: "",
      done: false,
      doneAt: null,
      priority: parsed.priority ?? 0,
      due: parsed.due ?? null,
      tags: parsed.tags ?? [],
      order: now,
      createdAt: now,
      updatedAt: now,
    })
  }

  const toggle = async (todo: Todo) => {
    const done = !todo.done

    await todos.put({
      ...todo,
      done,
      doneAt: done ? Date.now() : null,
      updatedAt: Date.now(),
    })
  }

  const startEdit = (todo: Todo) => {
    editingId = todo.id
    editDraft = todo.title
  }

  const commitEdit = async (todo: Todo) => {
    const title = editDraft.trim()

    editingId = null

    if (title && title !== todo.title) {
      await todos.put({ ...todo, title, updatedAt: Date.now() })
    }
  }

  const clearDone = async () => {
    for (const item of items) {
      if (item.done) {
        await todos.remove(item.id)
      }
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col">
  <header class="flex items-center gap-2 border-b border-base-300 px-3 py-3">
    <button
      type="button"
      class="btn btn-ghost btn-square btn-xs"
      aria-label={$t("common.back")}
      onclick={back}
    >
      <Icon icon="lucide:arrow-left" class="size-3.5" />
    </button>

    <div class="min-w-0 flex-1">
      <div class="text-[0.6875rem] tracking-wider text-base-content/55">
        {$t("panel.todos")}
      </div>
      <div class="mt-0.5 text-[0.8125rem] font-semibold">
        {$t("panel.todo.count", { values: { count: openCount } })}
      </div>
    </div>
  </header>

  <div class="border-b border-base-300 px-3 py-2">
    <input
      class="input input-sm w-full"
      placeholder={$t("panel.quickAdd.todo")}
      aria-label={$t("panel.todo.titleAria")}
      autocomplete="off"
      spellcheck="false"
      bind:value={draft}
      {@attach node => node.focus()}
      onkeydown={e => {
        if (e.key === "Enter") {
          add()
        }
      }}
    />
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
    {#if list.length === 0}
      <div class="px-3 py-8 text-center text-xs text-base-content/50">
        {$t("panel.todo.allDone")}
      </div>
    {/if}

    <ul>
      {#each list as todo (todo.id)}
        <li class="group relative">
          <div
            class="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors hover:bg-base-200/60"
          >
            <input
              type="checkbox"
              class="checkbox checkbox-primary checkbox-sm mt-0.5 shrink-0"
              checked={todo.done}
              aria-label={$t(todo.done ? "panel.todo.markNotDone" : "panel.todo.markDone")}
              onchange={() => toggle(todo)}
            />

            {#if editingId === todo.id}
              <input
                class="input input-xs min-w-0 flex-1"
                aria-label={$t("panel.todo.titleAria")}
                bind:value={editDraft}
                {@attach node => node.focus()}
                onblur={() => commitEdit(todo)}
                onkeydown={e => {
                  if (e.key === "Enter") {
                    commitEdit(todo)
                  } else if (e.key === "Escape") {
                    e.stopPropagation()
                    editingId = null
                  }
                }}
              />
            {:else}
              <button
                type="button"
                class="min-w-0 flex-1 cursor-text text-left"
                title={$t("panel.todo.editHint")}
                ondblclick={() => startEdit(todo)}
              >
                <div
                  class={[
                    "truncate text-[0.8125rem] font-medium",
                    todo.done && "line-through opacity-55",
                  ]}
                >
                  {todo.title}
                </div>

                {#if todo.due || todo.tags.length}
                  <div
                    class="tabular mt-0.5 flex items-center gap-1.5 text-[0.6875rem] text-base-content/55"
                  >
                    {#if todo.due}
                      <span class={isOverdue(todo) ? "text-error" : ""}>
                        {dueLabel(todo)}
                      </span>
                    {/if}

                    {#each todo.tags as tag (tag)}
                      <span class="text-base-content/45">#{tag}</span>
                    {/each}
                  </div>
                {/if}
              </button>
            {/if}

            {#if todo.priority}
              <Icon
                icon="lucide:flag"
                class={["mt-1 size-3 shrink-0", flagClass(todo.priority)]}
              />
            {/if}
          </div>

          <button
            type="button"
            class={[
              "absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2",
              "cursor-pointer place-items-center rounded text-base-content/45",
              "opacity-0 transition-opacity hover:bg-base-300 hover:text-error",
              "group-hover:opacity-100",
            ]}
            aria-label={$t("panel.todo.delete")}
            onclick={() => todos.remove(todo.id)}
          >
            <Icon icon="lucide:trash-2" class="size-3" />
          </button>
        </li>
      {/each}
    </ul>
  </div>

  {#if doneCount}
    <div class="flex flex-col border-t border-base-300 px-3 py-2">
      <button class="btn btn-sm btn-ghost justify-start" onclick={clearDone}>
        <Icon icon="lucide:check-check" class="size-3.5" />
        {$t("panel.todo.clearCompleted")}
      </button>
    </div>
  {/if}
</div>
