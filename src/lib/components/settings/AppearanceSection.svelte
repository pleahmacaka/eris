<script lang="ts">
  import Section from "$lib/components/ui/Section.svelte"
  import { patchAppearance, type ThemeMode, type TodoSort } from "$lib/settings"
  import { device } from "$lib/settings.svelte"

  const appearance = $derived(device.value.appearance)

  const MODES: { id: ThemeMode; label: string }[] = [
    { id: "system", label: "시스템" },
    { id: "dark", label: "어둡게" },
    { id: "light", label: "밝게" },
  ]

  const SORTS: { id: TodoSort; label: string }[] = [
    { id: "due", label: "마감순" },
    { id: "priority", label: "중요도순" },
    { id: "manual", label: "직접" },
  ]

  const setSort = (value: string) =>
    patchAppearance({ todoSort: value as TodoSort })
</script>

<Section title="화면">
  <div class="join w-full">
    {#each MODES as mode (mode.id)}
      <button
        class={[
          "btn join-item flex-1",
          appearance.mode === mode.id && "btn-primary",
        ]}
        onclick={() => patchAppearance({ mode: mode.id })}
      >
        {mode.label}
      </button>
    {/each}
  </div>

  <div class="flex items-center gap-3">
    <span class="w-24 shrink-0 text-sm">글자 크기</span>
    <input
      type="range"
      class="range range-primary range-sm flex-1"
      min="0.85"
      max="1.3"
      step="0.05"
      value={appearance.fontScale}
      onchange={e =>
        patchAppearance({ fontScale: Number(e.currentTarget.value) })}
    />
  </div>

  <label class="flex cursor-pointer items-center justify-between">
    <span class="text-sm">월요일 시작</span>
    <input
      type="checkbox"
      class="toggle toggle-primary toggle-sm"
      checked={appearance.weekStartsMonday}
      onchange={e =>
        patchAppearance({ weekStartsMonday: e.currentTarget.checked })}
    />
  </label>

  <div class="flex items-center gap-3">
    <span class="w-24 shrink-0 text-sm">할 일 정렬</span>
    <select
      class="select select-sm flex-1"
      value={appearance.todoSort}
      onchange={e => setSort(e.currentTarget.value)}
    >
      {#each SORTS as sort (sort.id)}
        <option value={sort.id}>{sort.label}</option>
      {/each}
    </select>
  </div>
</Section>
