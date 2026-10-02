<script lang="ts">
  import { applePainter } from "$lib/ascii/sources"
  import AsciiArt from "$lib/components/ascii/AsciiArt.svelte"
  import AsciiOrbit from "$lib/components/ascii/AsciiOrbit.svelte"
  import Eyebrow from "$lib/components/ui/Eyebrow.svelte"
  import type { Copy } from "$lib/copy/en"

  let { t }: { t: Copy } = $props()
</script>

<section
  id="story"
  aria-labelledby="story-title"
  class={[
    "mx-auto grid max-w-6xl items-center gap-x-16 gap-y-12 px-6 py-32",
    "lg:grid-cols-2",
  ]}
>
  <div class="flex flex-col gap-6">
    <Eyebrow>{t.story.label}</Eyebrow>

    <h2
      id="story-title"
      class="text-balance font-bold text-4xl tracking-tight sm:text-5xl"
    >
      {t.story.title}
    </h2>

    {#each t.story.body as paragraph (paragraph)}
      <p class="text-base-content/70 text-lg leading-relaxed">{paragraph}</p>
    {/each}
  </div>

  <figure
    class={[
      "flex flex-col items-center gap-6 rounded-box border px-6 py-12",
      "border-base-content/10 bg-base-200/60 text-center",
    ]}
  >
    <AsciiArt
      paint={applePainter}
      cols={46}
      rows={24}
      tint="--color-accent"
      interactive
      class="w-full max-w-xs cursor-crosshair"
    />

    <blockquote
      lang="grc"
      class="font-semibold text-4xl text-accent tracking-tight sm:text-5xl"
    >
      τῇ καλλίστῃ
    </blockquote>

    <figcaption class="text-base-content/60">{t.story.translation}</figcaption>
  </figure>
</section>

<section
  aria-labelledby="orbit-title"
  class={[
    "mx-auto grid max-w-6xl items-center gap-x-16 gap-y-12 px-6 pb-32",
    "lg:grid-cols-2",
  ]}
>
  <div class="flex flex-col gap-6 lg:order-last">
    <Eyebrow>{t.story.orbitLabel}</Eyebrow>

    <h2
      id="orbit-title"
      class="text-balance font-bold text-4xl tracking-tight sm:text-5xl"
    >
      {t.story.orbitTitle}
    </h2>

    <p class="text-base-content/70 text-lg leading-relaxed">
      {t.story.orbitBody}
    </p>
  </div>

  <AsciiOrbit class="mx-auto max-w-lg" />
</section>
