<script lang="ts">
  import { Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import Devices from "./Devices.svelte"
</script>

<Section title={$t("devices.title")}>
  <div class="px-4 py-3">
    <Devices />
  </div>
</Section>
