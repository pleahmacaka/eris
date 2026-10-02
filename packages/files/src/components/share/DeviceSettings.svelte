<script lang="ts">
  import { Row, Section } from "@eris/ui"
  import { t } from "svelte-i18n"
  import { prefs } from "../../store/prefs.svelte"
  import Devices from "./Devices.svelte"
  import { EXPIRY_PRESETS, type ExpiryPreset } from "./expiry"
</script>

<Section title={$t("devices.title")}>
  <div class="px-4 py-3">
    <Devices />
  </div>

  <Row label={$t("share.defaultExpiry")} hint={$t("share.defaultExpiryHint")}>
    <select
      class="select select-sm w-32"
      aria-label={$t("share.defaultExpiry")}
      value={prefs.shareExpiry}
      onchange={e => (prefs.shareExpiry = e.currentTarget.value as ExpiryPreset)}
    >
      {#each EXPIRY_PRESETS as preset (preset)}
        <option value={preset}>{$t(`share.expiryOptions.${preset}`)}</option>
      {/each}
    </select>
  </Row>
</Section>
