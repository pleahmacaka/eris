<script lang="ts">
  import { disable, enable } from "@tauri-apps/plugin-autostart"
  import { type DeviceSettings, defaultDevice } from "@eris/settings"
  import { LANGUAGES } from "@eris/i18n"
  import { Row, Section, toast } from "@eris/ui"
  import { t } from "svelte-i18n"
  import ImportExport from "../ImportExport.svelte"
  import { reset } from "../reset"

  let {
    device = $bindable(),
    onreset,
  }: { device: DeviceSettings; onreset: () => void } = $props()

  const resetRow = reset(() => device, defaultDevice)

  const message = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

  const setAutostart = async (on: boolean) => {
    try {
      if (on) {
        await enable()
      } else {
        await disable()
      }

      device.autostart = on
    } catch (error) {
      toast(
        $t("settings.toasts.autostartFailed", { values: { error: message(error) } }),
        "error",
      )
    }
  }
</script>

<Section title={$t("settings.groups.device")}>
  <Row
    label={$t("settings.rows.deviceName")}
    hint={$t("settings.hints.deviceName")}
    onreset={resetRow("deviceName")}
  >
    <input
      class="input input-sm w-52"
      aria-label={$t("settings.rows.deviceName")}
      autocomplete="off"
      spellcheck="false"
      bind:value={device.deviceName}
    />
  </Row>

  <Row
    label={$t("settings.rows.autostart")}
    hint={$t("settings.hints.autostart")}
    onreset={() => setAutostart(defaultDevice.autostart)}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.autostart")}
      checked={device.autostart}
      onchange={e => setAutostart(e.currentTarget.checked)}
    />
  </Row>

  <Row
    label={$t("settings.rows.language")}
    hint={$t("settings.hints.language")}
    onreset={resetRow("language")}
  >
    <select
      class="select select-sm w-40"
      aria-label={$t("settings.rows.language")}
      bind:value={device.language}
    >
      {#each LANGUAGES as language (language)}
        <option value={language}>{$t(`languages.${language}`)}</option>
      {/each}
    </select>
  </Row>

  <Row label={$t("settings.rows.setupWizard")} hint={$t("settings.hints.setupWizard")}>
    <button
      type="button"
      class="btn btn-soft btn-sm"
      onclick={onreset}
    >
      {$t("settings.options.runSetup")}
    </button>
  </Row>
</Section>

<Section
  title={$t("settings.groups.backup.title")}
  description={$t("settings.groups.backup.description")}
>
  <ImportExport />
</Section>
