<script lang="ts">
  import { type DeviceSettings, defaultDevice } from "@eris/settings"
  import { Row, Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import DockControls from "../DockControls.svelte"
  import FeatureGate from "../FeatureGate.svelte"
  import { reset } from "../reset"

  let { device = $bindable() }: { device: DeviceSettings } = $props()

  const resetRow = reset(() => device, defaultDevice)
</script>

<FeatureGate bind:device feature="dock" />

<fieldset
  class={[
    "flex flex-col gap-4 transition-opacity duration-100",
    !device.features.dock && "opacity-40",
  ]}
  disabled={!device.features.dock}
>
  <Section title={$t("settings.groups.dock")}>
    <DockControls bind:device />
  </Section>

  <Section title={$t("settings.groups.tray")}>
    {#each ["showBluetooth", "showNotifications", "showDesktopButton", "showTaskView", "showInputLanguage"] as const as toggle (toggle)}
      <Row
        label={$t(`settings.rows.${toggle}`)}
        hint={$t(`settings.hints.${toggle}`)}
        tag={toggle === "showBluetooth" || toggle === "showNotifications" ? "partial" : undefined}
        onreset={resetRow(toggle)}
      >
        <input
          type="checkbox"
          class="toggle toggle-primary"
          aria-label={$t(`settings.rows.${toggle}`)}
          bind:checked={device[toggle]}
        />
      </Row>
    {/each}
  </Section>
</fieldset>
