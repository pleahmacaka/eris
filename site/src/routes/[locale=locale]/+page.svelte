<script lang="ts">
import "virtual:iconify-embed"
import "../../app.css"
import Cta from "#lib/components/landing/Cta.svelte"
import Download from "#lib/components/landing/Download.svelte"
import Faq from "#lib/components/landing/Faq.svelte"
import Features from "#lib/components/landing/Features.svelte"
import Footer from "#lib/components/landing/Footer.svelte"
import Header from "#lib/components/landing/Header.svelte"
import Hero from "#lib/components/landing/Hero.svelte"
import Network from "#lib/components/landing/Network.svelte"
import Showcase from "#lib/components/landing/Showcase.svelte"
import Themes from "#lib/components/landing/Themes.svelte"
import Head from "#lib/components/seo/Head.svelte"
import type { PageProps } from "./$types"

let { data }: PageProps = $props()

const t = $derived(data.copy)
</script>

<Head meta={t.meta} seo={data.seo} />

<a
  class={[
    "btn btn-primary btn-sm sr-only",
    "focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50",
  ]}
  href="#content"
>
  {t.nav.skip}
</a>

<Header locale={data.locale} t={t.nav} />

<main id="content">
  <Hero {t} />
  <Showcase t={t.showcase} />
  <Features t={t.features} />
  <Themes t={t.themes} />
  <Download {t} />
  <Network t={t.network} />
  <Faq t={t.faq} />
  <Cta {t} />
</main>

<Footer locale={data.locale} {t} />
