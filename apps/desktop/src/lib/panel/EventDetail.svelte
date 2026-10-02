<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import EventForm from "./EventForm.svelte"
  import EventView from "./EventView.svelte"
  import type { Panel } from "./panel.svelte"

  const { panel }: { panel: Panel } = $props()

  const event = $derived(panel.openEvent)

  const view = $derived(panel.view)

  const editing = $derived(
    view.kind === "new" || (view.kind === "event" && view.editing),
  )

  const seed = $derived(
    view.kind === "new"
      ? view
      : { day: panel.selected, span: 0, parent: null },
  )
</script>

<div class="flex h-full min-h-0 flex-col">
  <header
    class="flex min-h-14 items-center gap-2 border-b border-base-300 px-4 py-3"
  >
    <Icon
      icon="lucide:calendar-check"
      class="size-4 shrink-0 text-base-content/60"
    />
    <h2 class="flex-1 truncate text-sm font-semibold">
      {editing ? $t("panel.event.edit") : $t("panel.event.detail")}
    </h2>

    <div class="flex items-center gap-0.5">
      {#if event && !editing}
        <button
          class="btn btn-ghost btn-square btn-xs"
          aria-label={$t("panel.event.edit")}
          onclick={panel.edit}
        >
          <Icon icon="lucide:pencil" class="size-3.5" />
        </button>

        <button
          class="btn btn-ghost btn-square btn-xs text-error"
          aria-label={$t("common.delete")}
          onclick={() => panel.remove(event)}
        >
          <Icon icon="lucide:trash-2" class="size-3.5" />
        </button>
      {/if}

      <button
        class="btn btn-ghost btn-square btn-xs"
        aria-label={$t("common.close")}
        onclick={panel.close}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    </div>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
    {#if editing}
      <EventForm {panel} {event} {seed} />
    {:else if event}
      <EventView {panel} {event} />
    {/if}
  </div>
</div>
