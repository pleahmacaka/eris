<script lang="ts">
  import { type Appearance, standaloneLook } from "@eris/settings"
  import { t } from "svelte-i18n"
  import AppearanceRows from "./AppearanceRows.svelte"
  import Row from "./Row.svelte"
  import Section from "./Section.svelte"
  import { erisStyle } from "./standalone.svelte"

  let {
    prefs,
    defaults = standaloneLook,
    essential = false,
  }: {
    prefs: { followEris: boolean; look: Appearance }
    defaults?: Appearance
    essential?: boolean
  } = $props()

  const following = $derived(erisStyle.linked && prefs.followEris)

  const resetKey = (key: keyof Appearance) => {
    prefs.look = { ...prefs.look, [key]: defaults[key] }
  }
</script>

<Section title={$t("settings.groups.linkedStyle")}>
  <Row
    label={$t("settings.rows.followEris")}
    hint={erisStyle.linked
      ? $t("settings.hints.followEris")
      : $t("settings.hints.erisMissing")}
  >
    <input
      type="checkbox"
      class="toggle toggle-primary"
      aria-label={$t("settings.rows.followEris")}
      disabled={!erisStyle.linked}
      bind:checked={prefs.followEris}
    />
  </Row>
</Section>

{#if !following}
  <AppearanceRows bind:appearance={prefs.look} {essential} onreset={resetKey} />
{/if}
