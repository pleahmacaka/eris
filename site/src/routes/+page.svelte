<script lang="ts">
import { alternates } from "#lib/i18n/alternates.js"
import { DEFAULT_LOCALE, LOCALES } from "#lib/i18n/locales.js"
import { redirectScript } from "#lib/i18n/redirect.js"
import { page } from "$app/state"

const script = `<script>${redirectScript}</${"script"}>`
</script>

<svelte:head>
  <title>Eris</title>
  {@html script}

  <noscript>
    <meta http-equiv="refresh" content="0; url={DEFAULT_LOCALE}/" />
  </noscript>

  {#each alternates(page.url.origin) as alternate (alternate.hreflang)}
    <link rel="alternate" hreflang={alternate.hreflang} href={alternate.href} />
  {/each}
</svelte:head>

<noscript>
  <ul>
    {#each LOCALES as locale (locale.tag)}
      <li>
        <a href="{locale.tag}/" hreflang={locale.tag} lang={locale.tag}>
          {locale.name}
        </a>
      </li>
    {/each}
  </ul>
</noscript>
