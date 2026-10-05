<script lang="ts">
  import Icon from "@iconify/svelte"
  import { open } from "@tauri-apps/plugin-dialog"
  import Section from "$lib/components/ui/Section.svelte"
  import { patchVault } from "$lib/settings"
  import { device } from "$lib/settings.svelte"
  import { importLegacyNotes, legacyImported } from "$lib/vault/legacy"
  import { folderPath } from "$lib/vault/paths"
  import { vault } from "$lib/vault/vault.svelte"
  import Group from "./Group.svelte"
  import Row from "./Row.svelte"

  const android = /Android/i.test(navigator.userAgent)

  let imported = $state(false)
  let message = $state("")
  let failure = $state("")
  let busy = $state(false)

  const custom = $derived(device.value.vault.path !== null)

  $effect(() => {
    if (vault.ready) {
      legacyImported().then(done => (imported = done))
    }
  })

  const attempt = async (task: () => Promise<void>) => {
    busy = true
    failure = ""
    message = ""

    try {
      await task()
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    } finally {
      busy = false
    }
  }

  const pick = () =>
    attempt(async () => {
      const chosen = await open({ directory: true, recursive: true })

      if (typeof chosen === "string") {
        await patchVault({ path: chosen })
      }
    })

  const importNotes = () =>
    attempt(async () => {
      const count = await importLegacyNotes()

      imported = true
      message = `메모 ${count}개를 가져왔습니다.`
    })

  const setTemplates = (value: string) => {
    const folder = folderPath(value.trim().replace(/^\/+|\/+$/g, ""))

    if (folder === null) {
      failure = "템플릿 폴더 이름이 올바르지 않습니다."

      return
    }

    failure = ""
    patchVault({ templates: folder })
  }
</script>

<Section title="볼트 위치">
  <div
    class={[
      "flex flex-col gap-4 border border-base-content/10",
      "bg-base-content/[0.02] p-4 @lg:flex-row @lg:items-center",
    ]}
  >
    <div class="flex min-w-0 flex-1 items-center gap-4">
      <span
        class={[
          "flex size-11 shrink-0 items-center justify-center border",
          "border-primary/30 bg-primary/10 text-primary",
        ]}
      >
        <Icon icon={custom ? "lucide:folder-open" : "lucide:vault"} class="size-5" />
      </span>

      <div class="min-w-0">
        <p class="flex items-center gap-2 text-sm font-medium">
          {custom ? "지정한 폴더" : "기본 폴더"}
          <span
            class={[
              "badge badge-xs",
              vault.ready ? "badge-success badge-soft" : "badge-ghost",
            ]}
          >
            {vault.ready ? "열림" : "여는 중"}
          </span>
        </p>
        <p class="mt-0.5 break-all text-xs text-base-content/50 select-text">
          {vault.root}
        </p>
      </div>
    </div>

    {#if !android}
      <div class="flex shrink-0 flex-wrap gap-2">
        {#if custom}
          <button
            class="btn btn-ghost btn-sm"
            disabled={busy}
            onclick={() => attempt(() => patchVault({ path: null }).then())}
          >
            기본 폴더
          </button>
        {/if}
        <button class="btn btn-sm" disabled={busy} onclick={pick}>
          <Icon icon="lucide:folder-search" class="size-4" />
          폴더 선택
        </button>
      </div>
    {/if}
  </div>
</Section>

<Group title="파일">
  <Row
    label="템플릿 폴더"
    hint="새 노트 템플릿 폴더입니다."
    icon="lucide:layout-template"
  >
    <input
      class="input input-sm w-44"
      value={device.value.vault.templates}
      placeholder="templates"
      aria-label="템플릿 폴더"
      onchange={e => setTemplates(e.currentTarget.value)}
    />
  </Row>

  <Row
    label="기존 메모 가져오기"
    hint="이전 버전 메모를 볼트에 파일로 저장합니다."
    icon="lucide:file-input"
  >
    <button
      class="btn btn-sm"
      disabled={busy || imported || !vault.ready}
      onclick={importNotes}
    >
      {#if imported}
        <Icon icon="lucide:check" class="size-4" />
        가져오기 완료
      {:else}
        가져오기
      {/if}
    </button>
  </Row>
</Group>

{#if message}
  <p class="-mt-5 text-xs text-success">{message}</p>
{/if}

{#if failure}
  <p class="-mt-5 whitespace-pre-wrap break-all text-xs text-error">
    {failure}
  </p>
{/if}
