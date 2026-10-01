<script lang="ts">
  import type { DeviceSettings, Profile } from "@eris/settings"
  import { Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import AppearanceControls from "../AppearanceControls.svelte"
  import DockControls from "../DockControls.svelte"
  import FeatureGate from "../FeatureGate.svelte"

  let {
    device = $bindable(),
    profile = $bindable(),
  }: { device: DeviceSettings; profile: Profile } = $props()
</script>

<FeatureGate bind:device feature="dock" />

<fieldset
  class={[
    "flex flex-col gap-4 transition-opacity duration-100",
    !device.features.dock && "opacity-40",
  ]}
  disabled={!device.features.dock}
>
  <Section title={$t("settings.groups.dockStyle")}>
    <DockControls bind:device part="style" />
  </Section>

  <Section title={$t("settings.groups.dockSize")}>
    <DockControls bind:device part="size" />
  </Section>

  <Section title={$t("settings.groups.dockBehavior")}>
    <DockControls bind:device part="behavior" />
  </Section>

  <Section title={$t("settings.groups.dockArrange")}>
    <DockControls bind:device part="arrange" />
  </Section>

  <Section
    title={$t("settings.groups.dockLook.title")}
    description={$t("settings.groups.dockLook.description")}
  >
    <AppearanceControls bind:profile part="dock" />
  </Section>
</fieldset>
