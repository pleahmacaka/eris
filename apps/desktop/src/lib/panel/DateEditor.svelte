<script lang="ts">
  import type { TimePicker } from "@eris/settings"
  import Icon from "@iconify/svelte"
  import { t } from "svelte-i18n"
  import ClockField from "./ClockField.svelte"
  import DateField from "./DateField.svelte"
  import type { Draft } from "./draft"
  import WheelField from "./WheelField.svelte"

  const { draft, change, weekStart, timePicker }: {
    draft: Draft
    change: (next: Partial<Draft>) => void
    weekStart: 0 | 1
    timePicker: TimePicker
  } = $props()

  const TimeField = $derived(timePicker === "clock" ? ClockField : WheelField)
</script>

<DateField
  value={draft.date}
  {weekStart}
  label={$t("panel.event.date")}
  onchange={date => change({ date })}
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
      <TimeField
        value={draft.start}
        label={$t("panel.event.start")}
        onchange={start => change({ start })}
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
        <TimeField
          value={draft.end}
          label={$t("panel.event.end")}
          onchange={end => change({ end })}
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
