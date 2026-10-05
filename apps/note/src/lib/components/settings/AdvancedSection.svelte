<script lang="ts">
  import Icon from "@iconify/svelte"
  import { patchAdvanced } from "$lib/settings"
  import { device } from "$lib/settings.svelte"
  import Group from "./Group.svelte"
  import Row from "./Row.svelte"

  const scripts = $derived(device.value.advanced.scripts)
</script>

<Group title="실행">
  <Row
    label="HTML 및 스크립트 실행"
    hint="노트의 HTML, CSS, JS를 격리된 영역에서 실행합니다. 다른 기기에서 동기화된 노트에도 적용됩니다."
    icon="lucide:code-xml"
  >
    <input
      type="checkbox"
      class="toggle toggle-primary toggle-sm"
      checked={scripts}
      aria-label="HTML 및 스크립트 실행"
      onchange={e => patchAdvanced({ scripts: e.currentTarget.checked })}
    />
  </Row>

  {#if scripts}
    <p
      class={[
        "flex items-start gap-2.5 bg-warning/5 px-4 py-3 text-xs",
        "leading-relaxed text-warning",
      ]}
    >
      <Icon icon="lucide:shield-alert" class="mt-px size-4 shrink-0" />
      스크립트는 앱과 분리된 프레임에서 돌아가 앱 데이터에는 닿지 않지만,
      노트를 읽기 화면으로 열면 바로 실행됩니다. 직접 쓰거나 믿는 기기에서 온
      노트에만 켜 두세요.
    </p>
  {/if}
</Group>
