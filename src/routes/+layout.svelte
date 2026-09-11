<script lang="ts">
import { injectAnalytics } from "@vercel/analytics/sveltekit"
import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit"
import { browser, dev } from "$app/environment"
import { registerIcons } from "$lib/icons/offline"
import * as m from "$lib/paraglide/messages"
import { getLocale, locales, localizeHref } from "$lib/paraglide/runtime"
import { SITE_NAME, SITE_URL } from "$lib/site"
import "../app.css"

registerIcons()

let { children } = $props()

if (browser) {
  injectAnalytics({ mode: dev ? "development" : "production" })
  injectSpeedInsights()
}

const description = `${m.tagline()} ${m.person_headline()}`

const canonical = `${SITE_URL}${localizeHref("/", { locale: getLocale() })}`

const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "pleahmacaka",
  url: SITE_URL,
  sameAs: [
    "https://github.com/pleahmacaka",
    "https://www.npmjs.com/~pleahmacaka",
    "https://tokscale.ai/u/pleahmacaka",
  ],
  knowsAbout: [
    "TypeScript",
    "Rust",
    "Svelte",
    "Tauri",
    "Nix",
    "On-device inference",
  ],
}
</script>

<svelte:head>
  <title>{SITE_NAME}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <link rel="icon" href="/logo.svg" type="image/svg+xml" />

  {#each locales as locale (locale)}
    <link
      rel="alternate"
      hreflang={locale}
      href="{SITE_URL}{localizeHref('/', { locale })}"
    />
  {/each}
  <link rel="alternate" hreflang="x-default" href="{SITE_URL}/" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={SITE_NAME} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content="{SITE_URL}/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />

  {@html `<script type="application/ld+json">${JSON.stringify(person)}<\/script>`}
</svelte:head>

{@render children()}
