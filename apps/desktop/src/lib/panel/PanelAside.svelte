<script lang="ts">
  import { Aura } from "@eris/ui"
  import { Ssgoi } from "@ssgoi/svelte"
  import { swapConfig } from "$lib/motion"
  import DayPane from "./DayPane.svelte"
  import EventDetail from "./EventDetail.svelte"
  import NotesPane from "./NotesPane.svelte"
  import type { Panel } from "./panel.svelte"
  import ScopeSheet from "./ScopeSheet.svelte"

  const { panel }: { panel: Panel } = $props()

  const view = $derived(panel.view)
</script>

<aside class="panel-surface relative flex min-h-0 w-full flex-col">
  <Aura />

  <Ssgoi config={swapConfig}>
    {#if panel.detailOpen}
      {@const key = view.kind === "event" ? `${view.id}@${view.date}` : "new"}
      {#key key}
        <div class="pane" data-ssgoi-transition="/event/{key}">
          <EventDetail {panel} />
        </div>
      {/key}
    {:else if view.kind === "notes"}
      <div class="pane" data-ssgoi-transition="/notes">
        <NotesPane items={panel.noteLive.items} back={panel.close} />
      </div>
    {:else}
      <div class="pane" data-ssgoi-transition="/day">
        <DayPane {panel} />
      </div>
    {/if}
  </Ssgoi>

  {#if panel.asking && !panel.detailOpen}
    <ScopeSheet
      mode={panel.asking.mode}
      scoped={panel.asking.scoped}
      choose={panel.asking.answer}
      cancel={() => panel.asking?.answer(null)}
    />
  {/if}
</aside>

<style>
  .pane {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
  }
</style>
