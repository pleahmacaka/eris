<script lang="ts">
  import Icon from "@iconify/svelte"
  import Section from "$lib/components/ui/Section.svelte"
  import {
    layout,
    PANELS,
    type PanelId,
    resetLayout,
  } from "$lib/workspace/layout.svelte"
  import Group from "./Group.svelte"
  import Row from "./Row.svelte"

  let done = $state(false)

  const reset = () => {
    resetLayout()
    layout.open.left = true
    layout.open.right = true
    done = true
  }

  const SIDES = [
    { side: "left", label: "왼쪽" },
    { side: "right", label: "오른쪽" },
  ] as const
</script>

{#snippet dock(label: string, panels: readonly PanelId[], open: boolean)}
  <div
    class={[
      "flex flex-col gap-1.5 border-base-content/10 bg-base-200/60 p-2",
      !open && "opacity-50",
    ]}
  >
    <p class="flex items-center justify-between text-2xs text-base-content/45">
      {label}
      {#if !open}
        <span>닫힘</span>
      {/if}
    </p>
    {#each panels as panel (panel)}
      <span
        class={[
          "flex items-center gap-1.5 border border-base-content/10",
          "bg-base-100 px-2 py-1 text-xs",
        ]}
      >
        <Icon icon={PANELS[panel].icon} class="size-3.5 text-primary/80" />
        <span class="truncate">{PANELS[panel].label}</span>
      </span>
    {:else}
      <span
        class="border border-dashed border-base-content/15 px-2 py-1 text-xs text-base-content/40"
      >
        없음
      </span>
    {/each}
  </div>
{/snippet}

<Section
  title="패널 배치"
  hint="아이콘과 탭을 끌어 위치를 바꿉니다."
>
  <div class="flex flex-col border border-base-content/10" aria-hidden="true">
    <div
      class="flex h-6 items-center gap-1.5 border-b border-base-content/10 px-2"
    >
      <span class="size-1.5 bg-primary"></span>
      <span class="h-1 w-10 bg-base-content/15"></span>
    </div>

    <div class="grid min-h-40 grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)]">
      {@render dock(SIDES[0].label, layout.docks.left, layout.open.left)}

      <div
        class="flex flex-col gap-1.5 border-x border-base-content/10 bg-base-100 p-3"
      >
        <span class="text-2xs text-base-content/45">편집기</span>
        <span class="h-1.5 w-3/4 bg-base-content/20"></span>
        <span class="h-1 w-full bg-base-content/10"></span>
        <span class="h-1 w-5/6 bg-base-content/10"></span>
        <span class="h-1 w-2/3 bg-base-content/10"></span>
        <span class="mt-2 h-1 w-1/2 bg-primary/40"></span>
        <span class="h-1 w-4/5 bg-base-content/10"></span>
      </div>

      {@render dock(SIDES[1].label, layout.docks.right, layout.open.right)}
    </div>
  </div>
</Section>

<Group title="초기화">
  <Row
    label="레이아웃 초기화"
    hint="패널 위치, 너비, 순서를 초기화합니다."
    icon="lucide:rotate-ccw"
  >
    <button class="btn btn-sm" onclick={reset}>
      {#if done}
        <Icon icon="lucide:check" class="size-4" />
        초기화 완료
      {:else}
        초기화
      {/if}
    </button>
  </Row>
</Group>
