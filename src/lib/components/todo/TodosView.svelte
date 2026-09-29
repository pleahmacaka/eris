<script lang="ts">
  import Icon from "@iconify/svelte"
  import { layout } from "$lib/workspace/layout.svelte"
  import TodoBoard from "./TodoBoard.svelte"
</script>

<div class="flex min-h-0 flex-1 flex-col overflow-y-auto bg-base-100">
  <div class="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col pt-3">
    {#if layout.todoDay}
      <button
        class="btn btn-ghost btn-xs mx-3 mb-1 self-start"
        onclick={() => (layout.todoDay = null)}
      >
        <Icon icon="lucide:x" class="size-3.5" />
        {layout.todoDay} 필터 해제
      </button>
    {/if}

    <TodoBoard day={layout.todoDay} />
  </div>
</div>
