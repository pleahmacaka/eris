<script lang="ts">
  import Icon from "@iconify/svelte"
  import Section from "$lib/components/ui/Section.svelte"
  import { patchAppearance, type ThemeMode, type TodoSort } from "$lib/settings"
  import { device } from "$lib/settings.svelte"
  import Group from "./Group.svelte"
  import Row from "./Row.svelte"
  import Segmented from "./Segmented.svelte"

  type Palette = { base: string; panel: string; line: string; ink: string }

  // previews keep their own colours so each card shows its theme, not the current one
  const DARK: Palette = {
    base: "oklch(15.5% 0.008 303)",
    panel: "oklch(11.5% 0.006 303)",
    line: "oklch(94% 0.006 303 / 0.12)",
    ink: "oklch(94% 0.006 303 / 0.55)",
  }

  const LIGHT: Palette = {
    base: "oklch(100% 0 0)",
    panel: "oklch(96.5% 0.004 303)",
    line: "oklch(22% 0.012 303 / 0.12)",
    ink: "oklch(22% 0.012 303 / 0.5)",
  }

  const MODES: { id: ThemeMode; label: string; icon: string }[] = [
    { id: "system", label: "시스템", icon: "lucide:monitor-cog" },
    { id: "dark", label: "어둡게", icon: "lucide:moon" },
    { id: "light", label: "밝게", icon: "lucide:sun" },
  ]

  const SORTS: { id: TodoSort; label: string }[] = [
    { id: "due", label: "마감순" },
    { id: "priority", label: "중요도순" },
    { id: "manual", label: "직접" },
  ]

  const WEEK = [
    { id: true, label: "월요일" },
    { id: false, label: "일요일" },
  ]

  const appearance = $derived(device.value.appearance)

  let scale = $state<number | null>(null)

  const shown = $derived(scale ?? appearance.fontScale)

  const halves = (mode: ThemeMode): Palette[] =>
    mode === "system" ? [DARK, LIGHT] : mode === "dark" ? [DARK] : [LIGHT]
</script>

<Section title="테마">
  <div class="grid grid-cols-3 gap-3" role="radiogroup" aria-label="테마">
    {#each MODES as mode (mode.id)}
      {@const active = appearance.mode === mode.id}
      <button
        class={[
          "group flex cursor-pointer flex-col gap-2.5 border p-2 text-left transition",
          active
            ? "border-primary bg-primary/5"
            : "border-base-content/10 hover:border-base-content/30",
        ]}
        role="radio"
        aria-checked={active}
        onclick={() => patchAppearance({ mode: mode.id })}
      >
        <span
          class="flex aspect-[4/3] w-full overflow-hidden border border-base-content/10"
          aria-hidden="true"
        >
          {#each halves(mode.id) as palette, i (i)}
            <span
              class="flex flex-1 flex-col"
              style="background: {palette.base}"
            >
              <span
                class="flex h-2.5 shrink-0 items-center gap-0.5 px-1"
                style="background: {palette.panel}; border-bottom: 1px solid {palette.line}"
              >
                <span class="size-1 bg-primary"></span>
              </span>
              <span class="flex flex-1">
                <span
                  class="w-1/4 shrink-0"
                  style="background: {palette.panel}; border-right: 1px solid {palette.line}"
                ></span>
                <span class="flex flex-1 flex-col gap-1 p-1.5">
                  <span class="h-1 w-3/4" style="background: {palette.ink}"
                  ></span>
                  <span class="h-1 w-1/2" style="background: {palette.line}"
                  ></span>
                  <span class="h-1 w-2/3" style="background: {palette.line}"
                  ></span>
                  <span class="mt-auto h-1.5 w-1/3 bg-primary/80"></span>
                </span>
              </span>
            </span>
          {/each}
        </span>

        <span class="flex items-center gap-2 px-0.5 text-sm">
          <Icon icon={mode.icon} class="size-3.5 opacity-60" />
          {mode.label}
          {#if active}
            <Icon icon="lucide:check" class="ml-auto size-3.5 text-primary" />
          {/if}
        </span>
      </button>
    {/each}
  </div>
</Section>

<Group title="글자와 달력">
  <Row
    label="글자 크기"
    hint="앱 전체의 글자와 여백을 함께 키우거나 줄입니다."
    icon="lucide:type"
  >
    <input
      type="range"
      class="range range-primary range-xs w-36"
      min="0.85"
      max="1.3"
      step="0.05"
      value={appearance.fontScale}
      aria-label="글자 크기"
      oninput={e => (scale = Number(e.currentTarget.value))}
      onchange={e => {
        scale = null
        patchAppearance({ fontScale: Number(e.currentTarget.value) })
      }}
    />
    <span class="tabular w-10 text-right text-xs text-base-content/60">
      {Math.round(shown * 100)}%
    </span>
  </Row>

  <Row
    label="한 주의 시작"
    hint="캘린더의 첫 번째 열입니다."
    icon="lucide:calendar-range"
  >
    <Segmented
      label="한 주의 시작"
      options={WEEK}
      value={appearance.weekStartsMonday}
      onchange={value => patchAppearance({ weekStartsMonday: value })}
    />
  </Row>

  <Row
    label="할 일 정렬"
    hint="할 일 보드에서 항목을 늘어놓는 순서입니다."
    icon="lucide:list-ordered"
  >
    <Segmented
      label="할 일 정렬"
      options={SORTS}
      value={appearance.todoSort}
      onchange={value => patchAppearance({ todoSort: value })}
    />
  </Row>
</Group>
