<script lang="ts">
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import type { Draft } from "./draft"

  const { draft, change }: {
    draft: Draft
    change: (next: Partial<Draft>) => void
  } = $props()

  const pickTime = (e: MouseEvent & { currentTarget: HTMLInputElement }) => {
    e.currentTarget.showPicker()
  }
</script>

<input
  type="date"
  class="input input-sm w-full tabular-nums"
  value={draft.date}
  onchange={e => e.currentTarget.value && change({ date: e.currentTarget.value })}
/>

{#if draft.allDay}
  <button
    type="button"
    class="btn btn-ghost btn-xs justify-start"
    onclick={() => change({ allDay: false })}
  >
    <Icon icon="lucide:plus" class="size-3.5" />
    {$t("panel.event.addTime")}
  </button>
{:else}
  <div class="flex items-center gap-2">
    <label class="input input-sm min-w-0 flex-1 gap-0 pr-1">
      <input
        type="time"
        class="time-field min-w-0 grow cursor-pointer tabular-nums"
        aria-label={$t("panel.event.start")}
        value={draft.start}
        onclick={pickTime}
        onchange={e => e.currentTarget.value && change({ start: e.currentTarget.value })}
      />

      <button
        type="button"
        class="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/60"
        aria-label={$t("panel.event.removeTime")}
        title={$t("panel.event.removeTime")}
        onclick={() => change({ allDay: true })}
      >
        <Icon icon="lucide:x" class="size-3.5" />
      </button>
    </label>

    {#if draft.hasEnd}
      <span class="text-base-content/50">–</span>

      <label class="input input-sm min-w-0 flex-1 gap-0 pr-1">
        <input
          type="time"
          class="time-field min-w-0 grow cursor-pointer tabular-nums"
          aria-label={$t("panel.event.end")}
          value={draft.end}
          onclick={pickTime}
          onchange={e => e.currentTarget.value && change({ end: e.currentTarget.value })}
        />

        <button
          type="button"
          class="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/60"
          aria-label={$t("panel.event.removeEnd")}
          title={$t("panel.event.removeEnd")}
          onclick={() => change({ hasEnd: false })}
        >
          <Icon icon="lucide:x" class="size-3.5" />
        </button>
      </label>
    {/if}
  </div>

  {#if !draft.hasEnd}
    <button
      type="button"
      class="btn btn-ghost btn-xs justify-start"
      onclick={() => change({ hasEnd: true })}
    >
      <Icon icon="lucide:plus" class="size-3.5" />
      {$t("panel.event.addEnd")}
    </button>
  {/if}
{/if}

<style>
  .time-field::-webkit-calendar-picker-indicator {
    display: none;
  }
</style>
