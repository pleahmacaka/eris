<script lang="ts">
import Icon from "@iconify/svelte"
import { logoArt } from "#lib/brand/ascii.js"
import AsciiArt from "#lib/components/brand/AsciiArt.svelte"
import Backdrop from "#lib/components/brand/Backdrop.svelte"
import Wordmark from "#lib/components/brand/Wordmark.svelte"
import Eyebrow from "#lib/components/ui/Eyebrow.svelte"
import { ARIXLAB, RELEASES, REPO } from "#lib/landing/content.js"
import { PLATFORM_ICONS } from "#lib/landing/icons.js"
import type { Copy } from "#lib/server/copy.js"

let { t }: { t: Copy } = $props()
</script>

<section
  aria-labelledby="hero-title"
  class="relative isolate flex min-h-dvh flex-col overflow-hidden"
>
  <Backdrop />

  <div
    class={[
      "mx-auto grid w-full max-w-6xl flex-1 items-center gap-x-12 gap-y-6",
      "px-6 pt-24 pb-24 lg:grid-cols-2",
    ]}
  >
    <AsciiArt
      art={logoArt}
      class="mx-auto w-full max-w-56 sm:max-w-sm lg:max-w-none"
    />

    <div
      class={[
        "flex min-w-0 flex-col items-center gap-6 text-center",
        "lg:items-start lg:text-start",
      ]}
    >
      <Eyebrow>{t.hero.eyebrow}</Eyebrow>

      <h1 id="hero-title" class="my-3 sm:my-4 lg:my-6">
        <span class="sr-only">Eris</span>
        <Wordmark class="h-18 sm:h-24 lg:h-32" />
      </h1>

      <p
        class={[
          "text-balance font-medium text-base-content/70 tracking-tight",
          "text-2xl sm:text-3xl",
        ]}
      >
        {t.hero.tagline}
      </p>

      <div
        class={[
          "mt-2 flex flex-wrap items-center justify-center gap-3",
          "lg:justify-start",
        ]}
      >
        <a class="btn btn-primary btn-lg" href="#download">
          <Icon icon="lucide:download" class="size-5" />
          {t.hero.download}
        </a>

        <a class="btn btn-ghost btn-lg" href={REPO}>
          {t.hero.source}
          <Icon icon="lucide:arrow-up-right" class="size-5 rtl:-scale-x-100" />
        </a>
      </div>

      <ul class="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
        {#each t.installers as platform (platform.id)}
          <li>
            <a class="btn btn-sm" href={RELEASES} aria-label={platform.action}>
              <Icon icon={PLATFORM_ICONS[platform.id]} class="size-4" />
              {platform.name}
            </a>
          </li>
        {/each}

        <li>
          <a class="btn btn-sm" href={REPO}>
            <Icon icon={PLATFORM_ICONS.web} class="size-4" />
            {t.web.name}
          </a>
        </li>
      </ul>
    </div>
  </div>

  <div
    class={[
      "absolute inset-x-6 bottom-6 flex items-center justify-between gap-4",
      "text-base-content/60 text-xs sm:inset-x-10 sm:bottom-8",
    ]}
  >
    <a class="transition hover:text-primary" href={ARIXLAB}>{t.hero.maker}</a>

    <a class="flex items-center gap-2 transition hover:text-primary" href="#preview">
      {t.hero.next}
      <Icon icon="lucide:arrow-down" class="size-3.5" />
    </a>
  </div>
</section>
