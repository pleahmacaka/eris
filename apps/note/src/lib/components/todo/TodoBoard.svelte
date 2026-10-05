<script lang="ts">
  import Icon from "@iconify/svelte"
  import { live } from "$lib/data/live.svelte"
  import { newId, todos } from "$lib/data/store"
  import { parseQuickAdd, sortTodos } from "$lib/data/todo"
  import type { Todo } from "$lib/data/types"
  import { device } from "$lib/settings.svelte"
  import { patchAppearance } from "$lib/settings"
  import TodoRow from "./TodoRow.svelte"

  const { day = null }: { day?: string | null } = $props()

  const store = live(todos)

  let entry = $state("")

  const appearance = $derived(device.value.appearance)

  const scoped = $derived(
    day === null
      ? store.items
      : store.items.filter(t => (t.due ?? "").slice(0, 10) === day),
  )

  const visible = $derived(
    sortTodos(scoped, appearance.todoSort, appearance.showCompleted),
  )

  const remaining = $derived(scoped.filter(t => !t.done).length)

  const add = async () => {
    const text = entry.trim()

    if (!text) {
      return
    }

    const parsed = parseQuickAdd(text)
    const stamp = Date.now()
    const todo: Todo = {
      id: newId(),
      title: parsed.title || text,
      notes: "",
      done: false,
      doneAt: null,
      priority: parsed.priority ?? 0,
      due: parsed.due ?? day,
      tags: parsed.tags ?? [],
      order: stamp,
      createdAt: stamp,
      updatedAt: stamp,
    }

    entry = ""
    await todos.put(todo)
  }
</script>

<div class="flex min-h-0 flex-1 flex-col">
  <div class="flex shrink-0 items-center gap-2 px-3 pb-3">
    <label class="input flex-1 bg-base-100">
      <Icon icon="lucide:plus" class="size-4 opacity-50" />
      <input
        placeholder="할 일 추가 (내일 3pm #업무 !2)"
        bind:value={entry}
        onkeydown={e => e.key === "Enter" && add()}
        class="grow"
      />
    </label>

    <button
      class="btn btn-ghost btn-square"
      aria-label="완료 항목 표시"
      onclick={() =>
        patchAppearance({ showCompleted: !appearance.showCompleted })}
    >
      <Icon
        icon={appearance.showCompleted ? "lucide:eye" : "lucide:eye-off"}
        class="size-4"
      />
    </button>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto px-3 pb-24">
    {#if store.ready && visible.length === 0}
      <div
        class={[
          "flex flex-col items-center gap-3 border border-dashed",
          "border-base-content/15 px-6 py-14 text-center",
        ]}
      >
        <Icon icon="lucide:check-check" class="size-8 opacity-25" />
        <p class="font-medium">할 일 없음</p>
        <p class="text-sm text-base-content/50">
          위 입력란에 할 일을 입력하고 Enter를 누르세요.
        </p>
      </div>
    {:else}
      <div class="flex items-center gap-2 px-1 pb-2">
        <span class="text-xs text-base-content/50">남은 항목</span>
        <span class="tabular text-xs font-medium text-primary">{remaining}</span>
        <span class="flex-1 border-t border-base-content/10"></span>
      </div>

      <ul class="flex flex-col gap-2">
        {#each visible as todo (todo.id)}
          <TodoRow {todo} />
        {/each}
      </ul>
    {/if}
  </div>
</div>
