<script lang="ts">
  import Icon from "@iconify/svelte"
  import { goto } from "$app/navigation"
  import { page } from "$app/state"
  import TodoBoard from "$lib/components/todo/TodoBoard.svelte"
  import TopBar from "$lib/components/ui/TopBar.svelte"

  const day = $derived(page.url.searchParams.get("day"))
</script>

<TopBar title="할 일" />

<main class="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col pt-2">
  {#if day}
    <button
      class="btn btn-ghost btn-xs mx-3 mb-1 self-start"
      onclick={() => goto("/todos")}
    >
      <Icon icon="lucide:x" class="size-3.5" />
      {day} 필터 해제
    </button>
  {/if}

  <TodoBoard {day} />
</main>
