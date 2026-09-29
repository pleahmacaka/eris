<script lang="ts">
  import CalendarView from "$lib/components/calendar/CalendarView.svelte"
  import SettingsView from "$lib/components/settings/SettingsView.svelte"
  import TodosView from "$lib/components/todo/TodosView.svelte"
  import { layout } from "$lib/workspace/layout.svelte"
  import { openView, type Tab } from "$lib/workspace/workspace.svelte"

  const { tab }: { tab: Tab } = $props()

  const note = () => import("$lib/components/editor/NoteView.svelte")
  const canvas = () => import("$lib/components/canvas/CanvasView.svelte")
  const graph = () => import("$lib/components/graph/GraphView.svelte")

  const openDay = (day: string) => {
    layout.todoDay = day
    openView("todos")
  }
</script>

{#snippet loading()}
  <div class="flex flex-1 items-center justify-center bg-base-100">
    <span class="loading loading-dots loading-sm text-primary"></span>
  </div>
{/snippet}

{#if tab.kind === "note" && tab.path}
  {#key tab.path}
    {#await note()}
      {@render loading()}
    {:then { default: NoteView }}
      <NoteView tabId={tab.id} path={tab.path} />
    {/await}
  {/key}
{:else if tab.kind === "canvas" && tab.path}
  {#key tab.path}
    {#await canvas()}
      {@render loading()}
    {:then { default: CanvasView }}
      <CanvasView path={tab.path} />
    {/await}
  {/key}
{:else if tab.kind === "graph"}
  {#await graph()}
    {@render loading()}
  {:then { default: GraphView }}
    <GraphView />
  {/await}
{:else if tab.kind === "calendar"}
  <CalendarView {openDay} />
{:else if tab.kind === "todos"}
  <TodosView />
{:else if tab.kind === "settings"}
  <SettingsView />
{/if}
