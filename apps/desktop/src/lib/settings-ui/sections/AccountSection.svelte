<script lang="ts">
  import { DesktopAccount } from "@eris/auth/tauri"
  import { Section } from "@eris/ui"
  import { locale, t } from "svelte-i18n"
</script>

<Section title={$t("settings.sections.account.label")}>
  <div class="px-4 py-4">
    <DesktopAccount lang={$locale} />
  </div>
</Section>
