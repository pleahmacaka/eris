<script lang="ts">
  import Icon from "@iconify/svelte"
  import Section from "$lib/components/ui/Section.svelte"
  import { layout, PANELS, resetLayout } from "$lib/workspace/layout.svelte"

  let done = $state(false)

  const reset = () => {
    resetLayout()
    layout.open.left = true
    layout.open.right = true
    done = true
  }

  const names = (panels: readonly (keyof typeof PANELS)[]) =>
    panels.length === 0 ? "없음" : panels.map(p => PANELS[p].label).join(", ")
</script>

<Section title="레이아웃">
  <div class="flex flex-col gap-3 border border-base-content/10 bg-base-100 p-4">
    <dl class="grid grid-cols-4 gap-y-1 text-sm">
      <dt class="text-base-content/50">왼쪽</dt>
      <dd class="col-span-3">{names(layout.docks.left)}</dd>
      <dt class="text-base-content/50">오른쪽</dt>
      <dd class="col-span-3">{names(layout.docks.right)}</dd>
    </dl>

    <p class="text-xs text-base-content/50">
      활동 표시줄 아이콘과 사이드바 탭을 끌어서 순서와 위치를 바꾸세요.
    </p>

    <button class="btn btn-sm self-start" onclick={reset}>
      <Icon icon="lucide:rotate-ccw" class="size-4" />
      {done ? "초기화 완료" : "레이아웃 초기화"}
    </button>
  </div>
</Section>
