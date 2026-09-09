<script lang="ts">
  import type { Profile } from "@eris/settings"
  import { Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import AppearanceControls from "../AppearanceControls.svelte"
  import PresetGrid from "../PresetGrid.svelte"

  let { profile = $bindable() }: { profile: Profile } = $props()
</script>

<Section
  title={$t("settings.groups.presets.title")}
  description={$t("settings.groups.presets.description")}
>
  <div data-row={$t("settings.rows.presets")} class="p-4">
    <PresetGrid bind:profile />
  </div>
</Section>

<Section
  title={$t("settings.groups.fineTune.title")}
  description={$t("settings.groups.fineTune.description")}
>
  <AppearanceControls bind:profile />
</Section>
