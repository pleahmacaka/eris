<script lang="ts">
  import Icon from "@iconify/svelte"
  import { logoPainter } from "$lib/ascii/sources"
  import AsciiArt from "$lib/components/ascii/AsciiArt.svelte"
  import AsciiField from "$lib/components/ascii/AsciiField.svelte"
  import Eyebrow from "$lib/components/ui/Eyebrow.svelte"
  import type { Copy } from "$lib/copy/en"
  import { ARIXLAB, RELEASES, REPO } from "$lib/links"

  let { t }: { t: Copy } = $props()
</script>

<section
  aria-labelledby="hero-title"
  class="relative isolate flex min-h-dvh flex-col overflow-hidden"
>
  <AsciiField class="absolute inset-0 -z-10 size-full" />
  <div class="vignette absolute inset-0 -z-10" aria-hidden="true"></div>

  <div
    class={[
      "mx-auto grid w-full max-w-6xl flex-1 items-center gap-x-12 gap-y-6",
      "px-6 pt-24 pb-20 lg:grid-cols-2",
    ]}
  >
    <AsciiArt
      paint={logoPainter}
      cols={64}
      rows={34}
      interactive
      class="mx-auto w-full max-w-xs cursor-crosshair sm:max-w-sm lg:max-w-none"
    />

    <div
      class={[
        "flex flex-col items-center gap-6 text-center",
        "lg:items-start lg:text-left",
      ]}
    >
      <Eyebrow>{t.hero.eyebrow}</Eyebrow>

      <h1
        id="hero-title"
        class={[
          "font-black leading-none tracking-tighter uppercase",
          "text-8xl sm:text-9xl lg:text-10xl",
        ]}
      >
        Eris
      </h1>

      <p
        class={[
          "font-medium tracking-tight text-base-content/70",
          "text-2xl sm:text-3xl",
        ]}
      >
        {t.hero.tagline}
      </p>

      <div class="mt-2 flex flex-wrap items-center justify-center gap-3">
        <a class="btn btn-primary btn-lg" href={RELEASES}>
          <Icon icon="lucide:download" class="size-5" />
          {t.hero.download}
        </a>

        <a class="btn btn-ghost btn-lg" href={REPO}>
          {t.hero.source}
          <Icon icon="lucide:arrow-up-right" class="size-5" />
        </a>
      </div>
    </div>
  </div>

  <div
    class={[
      "absolute inset-x-6 bottom-6 flex items-center justify-between gap-4",
      "text-base-content/60 text-xs sm:inset-x-10 sm:bottom-8",
    ]}
  >
    <a class="transition hover:text-primary" href={ARIXLAB}>
      {t.hero.maker}
    </a>

    <a
      class="flex items-center gap-2 transition hover:text-primary"
      href="#preview"
    >
      {t.hero.next}
      <Icon icon="lucide:arrow-down" class="size-3.5" />
    </a>
  </div>
</section>
