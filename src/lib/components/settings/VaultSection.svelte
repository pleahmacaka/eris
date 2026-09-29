<script lang="ts">
  import Icon from "@iconify/svelte"
  import { open } from "@tauri-apps/plugin-dialog"
  import Section from "$lib/components/ui/Section.svelte"
  import { patchVault } from "$lib/settings"
  import { device } from "$lib/settings.svelte"
  import { importLegacyNotes, legacyImported } from "$lib/vault/legacy"
  import { folderPath } from "$lib/vault/paths"
  import { vault } from "$lib/vault/vault.svelte"

  const android = /Android/i.test(navigator.userAgent)

  let imported = $state(false)
  let message = $state("")
  let failure = $state("")
  let busy = $state(false)

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
      failure = "템플릿 폴더 이름을 확인하세요."

      return
    }

    failure = ""
    patchVault({ templates: folder })
  }
</script>

<Section title="볼트">
  <div class="flex flex-col gap-3 border border-base-content/10 bg-base-100 p-4">
    <div class="flex items-start gap-3">
      <Icon icon="lucide:vault" class="mt-0.5 size-4 shrink-0 opacity-60" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium">
          {device.value.vault.path ? "지정한 폴더" : "기본 폴더"}
        </p>
        <p class="break-all text-xs text-base-content/50">{vault.root}</p>
      </div>
    </div>

    {#if !android}
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-sm" disabled={busy} onclick={pick}>
          <Icon icon="lucide:folder-open" class="size-4" />
          폴더 선택
        </button>
        {#if device.value.vault.path}
          <button
            class="btn btn-ghost btn-sm"
            disabled={busy}
            onclick={() => attempt(() => patchVault({ path: null }).then())}
          >
            기본 폴더 사용
          </button>
        {/if}
      </div>
    {/if}

    <label class="flex items-center gap-3">
      <span class="w-24 shrink-0 text-sm">템플릿 폴더</span>
      <input
        class="input input-sm flex-1"
        value={device.value.vault.templates}
        placeholder="templates"
        onchange={e => setTemplates(e.currentTarget.value)}
      />
    </label>
  </div>
</Section>

<Section title="기존 메모">
  <div class="flex flex-wrap items-center gap-3">
    <button
      class="btn btn-sm"
      disabled={busy || imported || !vault.ready}
      onclick={importNotes}
    >
      <Icon icon="lucide:file-input" class="size-4" />
      {imported ? "가져오기 완료" : "기존 메모 가져오기"}
    </button>
    <p class="text-xs text-base-content/50">
      이전 버전의 메모를 볼트의 메모 폴더에 파일로 저장합니다.
    </p>
  </div>

  {#if message}
    <p class="text-xs text-success">{message}</p>
  {/if}

  {#if failure}
    <p class="text-xs text-error">{failure}</p>
  {/if}
</Section>
