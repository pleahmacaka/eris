<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import type { TodoSort } from "@eris/settings"
  import {
    type Todo,
    dueLabel,
    isOverdue,
    quickTodo,
    sortTodos,
    todos,
    toggled,
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
    const todo = quickTodo(draft)

    if (todo) {
      draft = ""
      await todos.put(todo)
    }
  }

  let renaming: Promise<unknown> = Promise.resolve()

  // the title input blurs and saves before the checkbox click lands, so toggle the saved copy
  const toggle = async (todo: Todo) => {
    await renaming

    await todos.put(toggled((await todos.get(todo.id)) ?? todo))
  }

  const startEdit = (todo: Todo) => {
    editingId = todo.id
    editDraft = todo.title
  }

  const commitEdit = async (todo: Todo) => {
    if (editingId !== todo.id) {
      return
    }

    const title = editDraft.trim()

    editingId = null

    if (title && title !== todo.title) {
      renaming = todos.put({ ...todo, title, updatedAt: Date.now() })

      await renaming
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
  <header
    class="flex min-h-14 items-center gap-2 border-b border-base-300 px-3 py-3"
  >
    <button
      type="button"
      class="btn btn-ghost btn-square btn-xs"
      aria-label={$t("common.back")}
      onclick={back}
    >
      <Icon icon="lucide:arrow-left" class="size-3.5" />
    </button>

    <h2 class="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">
      {$t("panel.todos")}
    </h2>

    {#if openCount > 0}
      <span class="badge badge-ghost badge-sm shrink-0 tabular-nums">
        {$t("panel.todo.count", { values: { count: openCount } })}
      </span>
    {/if}
  </header>

  <div class="border-b border-base-300 p-2">
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

  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    {#if list.length === 0}
      <div
        class={[
          "flex h-full flex-col items-center justify-center gap-2",
          "text-base-content/50",
        ]}
      >
        <Icon icon="lucide:check-check" class="size-6 opacity-60" />
        <p class="text-xs">{$t("panel.todo.allDone")}</p>
      </div>
    {:else}
      <ul class="flex flex-col gap-0.5">
        {#each list as todo (todo.id)}
          <li class="group relative">
            <div
              class={[
                "flex w-full items-start gap-2.5 rounded-field py-2 pr-10 pl-2.5",
                "transition-colors duration-120 hover:bg-base-content/5",
              ]}
            >
              <input
                type="checkbox"
                class="checkbox checkbox-primary checkbox-sm shrink-0"
                checked={todo.done}
                aria-label={$t(
                  todo.done ? "panel.todo.markNotDone" : "panel.todo.markDone",
                )}
                onchange={() => toggle(todo)}
              />

              {#if editingId === todo.id}
                <textarea
                  class={[
                    "textarea textarea-xs min-h-0 min-w-0 flex-1 resize-none",
                    "text-sm [field-sizing:content]",
                  ]}
                  rows="1"
                  aria-label={$t("panel.todo.titleAria")}
                  bind:value={editDraft}
                  {@attach node => node.focus()}
                  onblur={() => commitEdit(todo)}
                  onkeydown={e => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      commitEdit(todo)
                    } else if (e.key === "Escape") {
                      e.stopPropagation()
                      editingId = null
                    }
                  }}
                ></textarea>
              {:else}
                <button
                  type="button"
                  class={[
                    "min-w-0 flex-1 cursor-text rounded-sm text-left",
                    "outline-none focus-visible:ring-2",
                    "focus-visible:ring-primary/50",
                  ]}
                  title={$t("panel.todo.editHint")}
                  ondblclick={() => startEdit(todo)}
                >
                  <span
                    class={[
                      "block text-sm font-medium break-words whitespace-pre-wrap",
                      "transition-opacity duration-120",
                      todo.done && "line-through opacity-55",
                    ]}
                  >
                    {todo.title}
                  </span>

                  {#if todo.due || todo.tags.length}
                    <span
                      class={[
                        "mt-0.5 flex items-center gap-1.5",
                        "text-2xs tabular-nums text-base-content/60",
                      ]}
                    >
                      {#if todo.due}
                        <span class={{ "text-error": isOverdue(todo) }}>
                          {dueLabel(todo)}
                        </span>
                      {/if}

                      {#each todo.tags as tag (tag)}
                        <span class="text-base-content/50">#{tag}</span>
                      {/each}
                    </span>
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
                "btn btn-ghost btn-square btn-xs absolute top-1.5 right-1.5",
                "text-base-content/60 opacity-0 transition-opacity duration-120",
                "group-hover:opacity-100 group-focus-within:opacity-100",
                "hover:text-error focus-visible:opacity-100",
              ]}
              aria-label={$t("panel.todo.delete")}
              onclick={() => todos.remove(todo.id)}
            >
              <Icon icon="lucide:trash-2" class="size-3.5" />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if doneCount}
    <div class="flex flex-col border-t border-base-300 p-2">
      <button class="btn btn-sm btn-ghost justify-start" onclick={clearDone}>
        <Icon icon="lucide:check-check" class="size-3.5" />
        {$t("panel.todo.clearCompleted")}
      </button>
    </div>
  {/if}
</div>
