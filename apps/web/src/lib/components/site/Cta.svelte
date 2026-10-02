<script lang="ts">
  import Icon from "@iconify/svelte"
  import { textPainter } from "$lib/ascii/raster"
  import AsciiArt from "$lib/components/ascii/AsciiArt.svelte"
  import AsciiField from "$lib/components/ascii/AsciiField.svelte"
  import type { Copy } from "$lib/copy/en"
  import { RELEASES } from "$lib/links"

  let { t }: { t: Copy } = $props()

  const wordmark = textPainter("ERIS")
</script>

<section
  aria-labelledby="cta-title"
  class="relative isolate overflow-hidden px-6 py-32 text-center"
>
  <AsciiField class="absolute inset-0 -z-10 size-full" />
  <div class="vignette absolute inset-0 -z-10" aria-hidden="true"></div>

  <div class="mx-auto flex max-w-4xl flex-col items-center gap-6">
    <AsciiArt
      paint={wordmark}
      cols={96}
      rows={14}
      tint="--color-secondary"
      interactive
      class="w-full cursor-crosshair"
    />

    <h2
      id="cta-title"
      class={[
        "mt-4 text-balance font-black tracking-tighter",
        "text-5xl sm:text-6xl",
      ]}
    >
      {t.cta.title}
    </h2>

    <p class="text-base-content/70 text-lg">{t.cta.body}</p>

    <a class="btn btn-primary btn-lg mt-4" href={RELEASES}>
      <Icon icon="lucide:download" class="size-5" />
      {t.cta.download}
    </a>
  </div>
</section>
