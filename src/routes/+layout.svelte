<script lang="ts">
import { injectAnalytics } from "@vercel/analytics/sveltekit"
import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit"
import { browser } from "$app/environment"
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "$lib/site"
import "../app.css"

let { children } = $props()

if (browser) {
  injectAnalytics()
  injectSpeedInsights()
}

const person = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "pleahmacaka",
  url: SITE_URL,
  sameAs: [
    "https://github.com/pleahmacaka",
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
  <meta name="description" content={SITE_DESCRIPTION} />
  <link rel="canonical" href={SITE_URL} />
  <link rel="icon" href="/icon.svg" type="image/svg+xml" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={SITE_NAME} />
  <meta property="og:description" content={SITE_DESCRIPTION} />
  <meta property="og:url" content={SITE_URL} />
  <meta property="og:image" content="{SITE_URL}/og.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />

  {@html `<script type="application/ld+json">${JSON.stringify(person)}<\/script>`}
</svelte:head>

{@render children()}
