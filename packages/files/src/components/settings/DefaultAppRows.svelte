<script lang="ts">
  import { Row, toast } from "@eris/ui"
  import { t } from "svelte-i18n"
  import {
    type DefaultApp,
    defaultAppStatus,
    openDefaultApps,
    setDefaultApp,
  } from "../../native"

  let {
    handler = $bindable({ supported: false, enabled: false }),
    windows = true,
  }: { handler?: DefaultApp; windows?: boolean } = $props()

  $effect(() => {
    defaultAppStatus()
      .then(status => (handler = status))
      .catch(() => undefined)
  })

  const toggleDefault = async (toggle: HTMLInputElement) => {
    try {
      handler = await setDefaultApp(toggle.checked)
    } catch {
      toast($t("explorer.settings.defaultAppUnavailable"), "error")
    }

    toggle.checked = handler.enabled
  }
</script>

<Row
  label={$t("explorer.settings.defaultAppLabel")}
  hint={handler.supported
    ? $t("explorer.settings.defaultAppHint")
    : $t("explorer.settings.defaultAppUnavailable")}
>
  <input
    type="checkbox"
    class="toggle toggle-primary"
    aria-label={$t("explorer.settings.defaultAppLabel")}
    checked={handler.enabled}
    disabled={!handler.supported}
    onchange={e => toggleDefault(e.currentTarget)}
  />
</Row>

{#if windows}
  <Row
    label={$t("explorer.settings.windowsDefaults")}
    hint={$t("explorer.settings.windowsDefaultsHint")}
  >
    <button
      type="button"
      class="btn btn-soft btn-sm"
      disabled={!handler.supported}
      onclick={() =>
        openDefaultApps().catch(() =>
          toast($t("explorer.settings.defaultAppUnavailable"), "error"),
        )}
    >
      {$t("common.open")}
    </button>
  </Row>
{/if}
