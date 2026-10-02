<script lang="ts">
  import { copy, type Lang } from "$lib/copy/languages"
  import Cta from "./Cta.svelte"
  import Features from "./Features.svelte"
  import Footer from "./Footer.svelte"
  import Header from "./Header.svelte"
  import Hero from "./Hero.svelte"
  import Specs from "./Specs.svelte"
  import Story from "./Story.svelte"

  let { lang }: { lang: Lang } = $props()

  const t = $derived(copy[lang])
</script>

<svelte:head>
  <title>{t.meta.title}</title>
  <meta name="description" content={t.meta.description} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Eris" />
  <meta property="og:title" content={t.meta.title} />
  <meta property="og:description" content={t.meta.description} />
</svelte:head>

<a
  class={[
    "btn btn-primary btn-sm sr-only",
    "focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50",
  ]}
  href="#content"
>
  {t.skip}
</a>

<Header {lang} {t} />

<main id="content">
  <Hero {t} />
  <Story {t} />
  <Features {t} />
  <Specs {t} />
  <Cta {t} />
</main>

<Footer {t} />
