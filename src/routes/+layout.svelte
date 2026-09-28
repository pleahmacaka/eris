<script lang="ts">
import { injectAnalytics } from "@vercel/analytics/sveltekit"
import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit"
import { browser, dev } from "$app/environment"
import { page } from "$app/state"
import { OPERATOR } from "$lib/data/nodes"
import { services, serviceUrl } from "$lib/data/services"
import * as m from "$lib/paraglide/messages"
import {
  deLocalizeHref,
  getLocale,
  locales,
  localizeHref,
} from "$lib/paraglide/runtime"
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "$lib/site"
import "../app.css"

let { children } = $props()

if (browser) {
  injectAnalytics({ mode: dev ? "development" : "production" })
  injectSpeedInsights()
}

const description = `${SITE_TAGLINE} ${m.hero_personal()}`

const path = $derived(deLocalizeHref(page.url.pathname))

const canonical = $derived(
  `${SITE_URL}${localizeHref(path, { locale: getLocale() })}`,
)

const title = $derived(page.data.title ?? SITE_NAME)

const site = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  author: {
    "@type": "Person",
    name: OPERATOR.handle,
    url: OPERATOR.href,
    sameAs: ["https://www.npmjs.com/~pleahmacaka"],
  },
  hasPart: services.map(s => ({
    "@type": "WebSite",
    name: s.name,
    url: serviceUrl(s),
  })),
}
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <link rel="icon" href="/logo.svg" type="image/svg+xml" />
  <meta name="theme-color" content="#050407" />

  {#each locales as locale (locale)}
    <link
      rel="alternate"
      hreflang={locale}
      href="{SITE_URL}{localizeHref(path, { locale })}"
    />
  {/each}
  <link rel="alternate" hreflang="x-default" href="{SITE_URL}{path}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content="{SITE_URL}/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />

  {@html `<script type="application/ld+json">${JSON.stringify(site)}<\/script>`}
</svelte:head>

<div
  class="scanlines pointer-events-none fixed inset-0 z-50 opacity-50"
  aria-hidden="true"
></div>

{@render children()}

