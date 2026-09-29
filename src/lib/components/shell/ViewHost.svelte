<script lang="ts">
  import CalendarView from "$lib/components/calendar/CalendarView.svelte"
  import CanvasView from "$lib/components/canvas/CanvasView.svelte"
  import NoteView from "$lib/components/editor/NoteView.svelte"
  import GraphView from "$lib/components/graph/GraphView.svelte"
  import SettingsView from "$lib/components/settings/SettingsView.svelte"
  import TodosView from "$lib/components/todo/TodosView.svelte"
  import { layout } from "$lib/workspace/layout.svelte"
  import { openView, type Tab } from "$lib/workspace/workspace.svelte"

  const { tab }: { tab: Tab } = $props()

  const openDay = (day: string) => {
    layout.todoDay = day
    openView("todos")
  }
</script>

{#if tab.kind === "note" && tab.path}
  {#key tab.path}
    <NoteView tabId={tab.id} path={tab.path} />
  {/key}
{:else if tab.kind === "canvas" && tab.path}
  {#key tab.path}
    <CanvasView path={tab.path} />
  {/key}
{:else if tab.kind === "graph"}
  <GraphView />
{:else if tab.kind === "calendar"}
  <CalendarView {openDay} />
{:else if tab.kind === "todos"}
  <TodosView />
{:else if tab.kind === "settings"}
  <SettingsView />
{/if}
