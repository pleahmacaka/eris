<script lang="ts">
  import { Section } from "@eris/ui"
  import { locale, t } from "svelte-i18n"
</script>

<Section title={$t("settings.sections.account.label")}>
  <div class="px-4 py-4">
    {#await import("@eris/auth/tauri") then { DesktopAccount }}
      <DesktopAccount lang={$locale} />
    {/await}
  </div>
</Section>
