<script lang="ts">
  import { LazyDesktopAccount } from "@eris/auth"
  import { Section } from "@eris/ui"
  import { locale, t } from "svelte-i18n"
</script>

<Section title={$t("settings.sections.account.label")}>
  <div class="px-4 py-4">
    <LazyDesktopAccount lang={$locale} />
  </div>
</Section>
