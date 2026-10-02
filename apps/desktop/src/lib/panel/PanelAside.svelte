<script lang="ts">
  import DayPane from "./DayPane.svelte"
  import EventDetail from "./EventDetail.svelte"
  import NotesPane from "./NotesPane.svelte"
  import type { Panel } from "./panel.svelte"
  import ScopeSheet from "./ScopeSheet.svelte"
  import TodoPane from "./TodoPane.svelte"

  const { panel }: { panel: Panel } = $props()

  const view = $derived(panel.view)

  const detailKey = $derived(
    view.kind === "event" ? `${view.id}@${view.date}` : view,
  )
</script>

<aside class="panel-surface flex min-h-0 flex-col">
  {#if view.kind === "todo"}
    <div class="pane">
      <TodoPane
        items={panel.todoLive.items}
        sortBy={panel.profile.todo.sortBy}
        showCompleted={panel.profile.todo.showCompleted}
        back={panel.close}
      />
    </div>
  {:else if view.kind === "notes"}
    <div class="pane">
      <NotesPane items={panel.noteLive.items} back={panel.close} />
    </div>
  {:else if panel.detailOpen}
    {#key detailKey}
      <div class="pane">
        <EventDetail {panel} />
      </div>
    {/key}
  {:else}
    <div class="pane">
      <DayPane {panel} />
    </div>
  {/if}

  {#if panel.asking}
    <ScopeSheet
      mode={panel.asking.mode}
      choose={panel.asking.answer}
      cancel={() => panel.asking?.answer(null)}
    />
  {/if}
</aside>

<style>
  .pane {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    animation: pane-in 140ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes pane-in {
    from {
      opacity: 0;
      transform: translateY(0.25rem);
    }
  }
</style>
