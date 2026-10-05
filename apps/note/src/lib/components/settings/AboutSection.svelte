<script lang="ts">
  import { NOTE_SCHEME } from "@eris/bridge"
  import Icon from "@iconify/svelte"
  import Section from "$lib/components/ui/Section.svelte"
  import { openExternal } from "$lib/platform/links"
  import { appVersion } from "$lib/platform/runtime"
  import { device } from "$lib/settings.svelte"
  import Group from "./Group.svelte"
  import Row from "./Row.svelte"

  const SITE = "https://arixlab.com/note"

  const SOURCE = "https://github.com/pleahmacaka/eris/tree/main/apps/note"

  let version = $state<string | null>(null)

  appVersion()
    .then(v => (version = v))
    .catch(() => {})
</script>

<Section title="Note">
  <div
    class={[
      "flex items-center gap-5 border border-base-content/10",
      "bg-base-content/[0.02] p-5",
    ]}
  >
    <img class="size-12 shrink-0" src="/icon.svg" width="48" height="48" alt="" />

    <div class="min-w-0">
      <p class="flex items-baseline gap-2">
        <span class="text-lg font-bold tracking-tight">ArixLab Note</span>
        <span class="tabular text-xs text-base-content/50">{version ?? ""}</span>
      </p>
      <p class="text-sm text-base-content/55">
        기기 사이에서 동기화되는 노트, 할 일, 캘린더
      </p>
    </div>
  </div>
</Section>

<Group title="Eris 연동">
  <Row
    label="일정 공유"
    hint="같은 체인에 연결된 Eris와 캘린더 일정을 주고받습니다. 노트와 할 일은 Note끼리만 동기화됩니다."
    icon="lucide:calendar-sync"
  />
  <Row
    label="노트 인용"
    hint="Eris 일정에 붙인 노트 링크를 누르면 Note에서 그 노트가 열립니다. 링크는 파일 목록의 우클릭 메뉴에서 인용 링크 복사로 만듭니다."
    icon="lucide:quote"
  >
    <code class="border border-base-content/10 px-2 py-0.5 text-xs text-primary">
      {NOTE_SCHEME}://
    </code>
  </Row>
</Group>

<Group title="이 앱">
  <Row label="기기 ID" icon="lucide:fingerprint">
    <span class="verbatim max-w-48 truncate text-xs text-base-content/50 select-text">
      {device.value.deviceId || "-"}
    </span>
  </Row>
  <Row label="웹사이트" hint="arixlab.com/note" icon="lucide:globe">
    <button class="btn btn-ghost btn-sm" onclick={() => openExternal(SITE)}>
      열기
      <Icon icon="lucide:arrow-up-right" class="size-4" />
    </button>
  </Row>
  <Row label="소스 코드" hint="pleahmacaka/eris · apps/note" icon="lucide:github">
    <button class="btn btn-ghost btn-sm" onclick={() => openExternal(SOURCE)}>
      열기
      <Icon icon="lucide:arrow-up-right" class="size-4" />
    </button>
  </Row>
</Group>
