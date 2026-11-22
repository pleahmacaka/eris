<script lang="ts">
import type { Copy } from "#lib/server/copy.js"
import type { Seo } from "#lib/server/seo.js"

type Props = { meta: Copy["meta"]; seo: Seo }

let { meta, seo }: Props = $props()
</script>

<svelte:head>
  <title>{meta.title}</title>
  <meta name="description" content={meta.description} />
  <link rel="canonical" href={seo.canonical} />

  {#each seo.alternates as alternate (alternate.hreflang)}
    <link rel="alternate" hreflang={alternate.hreflang} href={alternate.href} />
  {/each}

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Eris" />
  <meta property="og:title" content={meta.title} />
  <meta property="og:description" content={meta.description} />
  <meta property="og:url" content={seo.canonical} />
  <meta property="og:locale" content={seo.locale} />
  <meta property="og:image" content={seo.image.url} />
  <meta property="og:image:width" content={seo.image.width} />
  <meta property="og:image:height" content={seo.image.height} />
  <meta property="og:image:alt" content={meta.title} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>
