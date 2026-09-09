<script lang="ts">
  import type { DeviceSettings } from "@eris/settings"
  import { Row, Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import DockControls from "../DockControls.svelte"

  let { device = $bindable() }: { device: DeviceSettings } = $props()
</script>

<Section title={$t("settings.groups.dock")}>
  <DockControls bind:device />
</Section>

<Section title={$t("settings.groups.tray")}>
  {#each ["showBluetooth", "showNotifications", "showDesktopButton", "showTaskView", "showInputLanguage"] as const as toggle (toggle)}
    <Row
      label={$t(`settings.rows.${toggle}`)}
      hint={$t(`settings.hints.${toggle}`)}
      tag={toggle === "showBluetooth" || toggle === "showNotifications" ? "partial" : undefined}
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
