<script lang="ts">
  import Section from "$lib/components/ui/Section.svelte"
  import { patchAdvanced } from "$lib/settings"
  import { device } from "$lib/settings.svelte"
</script>

<Section title="고급">
  <label
    class={[
      "flex cursor-pointer items-start justify-between gap-4 border",
      "border-base-content/10 bg-base-100 p-4",
    ]}
  >
    <span class="min-w-0">
      <span class="block text-sm font-medium">HTML 및 스크립트 실행</span>
      <span class="block text-xs text-base-content/50">
        노트의 HTML, CSS, JS를 격리된 영역에서 실행합니다. 다른 기기에서
        동기화된 노트에도 적용됩니다.
      </span>
    </span>

    <input
      type="checkbox"
      class="toggle toggle-primary toggle-sm mt-0.5 shrink-0"
      checked={device.value.advanced.scripts}
      onchange={e => patchAdvanced({ scripts: e.currentTarget.checked })}
    />
  </label>
</Section>
