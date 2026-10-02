<script lang="ts">
  import { Row } from "@eris/ui"
  import { t } from "svelte-i18n"
  import {
    type FilesDefault,
    filesDefault,
    openErisFiles,
    openFilesDefaults,
  } from "$lib/native/files"

  let { launch = true }: { launch?: boolean } = $props()

  let files = $state<FilesDefault>({ supported: false, enabled: false })
  let busy = $state(false)

  $effect(() => {
    filesDefault()
      .then(next => {
        files = next
      })
      .catch(() => undefined)
  })

  const toggle = async (enable: boolean) => {
    busy = true
    files = await filesDefault(enable).catch(() => files)
    busy = false
  }
</script>

{#if launch}
  <Row label={$t("settings.rows.erisFiles")} hint={$t("settings.hints.erisFiles")}>
    <button
      type="button"
      class="btn btn-soft btn-sm"
      disabled={!files.supported}
      onclick={() => openErisFiles().catch(() => undefined)}
    >
      {$t("common.open")}
    </button>
  </Row>
{/if}

<Row
  label={$t("settings.rows.filesDefault")}
  hint={files.supported ? $t("settings.hints.filesDefault") : $t("settings.hints.filesMissing")}
>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label={$t("settings.rows.filesDefault")}
    checked={files.enabled}
    disabled={!files.supported || busy}
    onchange={e => toggle(e.currentTarget.checked)}
  />
</Row>

<Row
  label={$t("settings.rows.filesDefaultApps")}
  hint={$t("settings.hints.filesDefaultApps")}
>
  <button
    type="button"
    class="btn btn-soft btn-sm"
    disabled={!files.supported}
    onclick={() => openFilesDefaults().catch(() => undefined)}
  >
    {$t("common.open")}
  </button>
</Row>
