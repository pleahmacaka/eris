<script lang="ts">
  import { type DeviceSettings, defaultDevice } from "@eris/settings"
  import { Row, Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { reset } from "./reset"

  const ROW: Record<keyof DeviceSettings["features"], string> = {
    dock: "featureDock",
    launcher: "featureLauncher",
    chat: "featureChat",
    calendar: "featureCalendar",
  }

  let {
    device = $bindable(),
    feature,
  }: {
    device: DeviceSettings
    feature: keyof DeviceSettings["features"]
  } = $props()

  const row = $derived(ROW[feature])

  const resetRow = reset(() => device.features, defaultDevice.features)
</script>

<Section title={$t("settings.groups.featureGate")}>
  <Row
    label={$t(`settings.rows.${row}`)}
    hint={$t(`settings.hints.${row}`)}
    onreset={resetRow(feature)}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t(`settings.rows.${row}`)}
      bind:checked={device.features[feature]}
    />
  </Row>
</Section>
