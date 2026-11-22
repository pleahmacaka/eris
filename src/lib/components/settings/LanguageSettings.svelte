<script lang="ts">
import { i18n } from "#lib/i18n/i18n.svelte.js"
import {
  LOCALES,
  localeInfo,
  parseLocalePreference,
} from "#lib/i18n/locales.js"

const systemName = $derived(localeInfo(i18n.system).name)
</script>

<section class="flex flex-col gap-3 rounded-box border border-base-content/10 bg-base-100/50 p-6">
  <h2 id="language-settings-title" class="font-bold">
    {i18n.t("settings.language.title")}
  </h2>
  <select
    class="select w-full"
    aria-labelledby="language-settings-title"
    value={i18n.preference}
    onchange={event =>
      i18n.setPreference(parseLocalePreference(event.currentTarget.value))}
  >
    <option value="system">
      {i18n.t("settings.language.system", { language: systemName })}
    </option>
    {#each LOCALES as locale (locale.tag)}
      <option value={locale.tag} lang={locale.tag} dir={locale.dir}>
        {locale.name}
      </option>
    {/each}
  </select>
</section>
