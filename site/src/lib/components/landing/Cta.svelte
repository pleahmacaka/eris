<script lang="ts">
import Icon from "@iconify/svelte"
import { reveal } from "#lib/attachments/reveal.js"
import { wordmarkArt } from "#lib/brand/ascii.js"
import AsciiArt from "#lib/components/brand/AsciiArt.svelte"
import Backdrop from "#lib/components/brand/Backdrop.svelte"
import { RELEASES } from "#lib/landing/content.js"
import type { Copy } from "#lib/server/copy.js"

let { t }: { t: Copy } = $props()
</script>

<section
  aria-labelledby="cta-title"
  class="relative isolate overflow-hidden px-6 py-32 text-center"
>
  <Backdrop />

  <div {@attach reveal} class="mx-auto flex max-w-4xl flex-col items-center gap-6">
    <AsciiArt art={wordmarkArt} class="w-full max-w-2xl" />

    <h2
      id="cta-title"
      class={[
        "wrap-break-word mt-4 text-balance font-black tracking-tighter",
        "text-4xl sm:text-6xl",
      ]}
    >
      {t.cta.title}
    </h2>

    <p class="text-base-content/70 text-lg">{t.cta.body}</p>

    <a class="btn btn-primary btn-lg mt-4" href={RELEASES}>
      <Icon icon="lucide:download" class="size-5" />
      {t.hero.download}
    </a>
  </div>
</section>
