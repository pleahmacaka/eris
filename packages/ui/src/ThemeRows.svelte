<script lang="ts">
  import type { ThemePrefs } from "@eris/settings"
  import { t } from "svelte-i18n"
  import Row from "./Row.svelte"
  import Segmented from "./Segmented.svelte"
  import { erisStyle } from "./standalone.svelte"

  let { prefs }: { prefs: ThemePrefs } = $props()
</script>

<Row
  label={$t("settings.rows.followEris")}
  hint={erisStyle.linked
    ? $t("settings.hints.followEris")
    : $t("settings.hints.erisMissing")}
>
  <input
    type="checkbox"
    class="toggle toggle-sm toggle-primary"
    aria-label={$t("settings.rows.followEris")}
    disabled={!erisStyle.linked}
    bind:checked={prefs.followEris}
  />
</Row>

{#if !erisStyle.linked || !prefs.followEris}
  <Row label={$t("settings.rows.mode")}>
    <Segmented
      label={$t("settings.rows.mode")}
      bind:value={prefs.mode}
      options={[
        { value: "system", label: $t("settings.options.system") },
        { value: "light", label: $t("settings.options.light") },
        { value: "dark", label: $t("settings.options.dark") },
      ]}
    />
  </Row>
{/if}
