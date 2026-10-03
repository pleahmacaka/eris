<script lang="ts">
  import Stage from "@eris/community/Stage.svelte"
  import type { Copy } from "$lib/copy/en"
  import { STUDIO } from "$lib/links"

  let { t }: { t: Copy } = $props()
</script>

<section id="preview" aria-label={t.preview.title} class="mx-auto max-w-6xl px-6 py-24">
  <div class="overflow-hidden rounded-box border border-base-content/10">
    <Stage
      studio={STUDIO}
      appearance={{}}
      surface="desktop"
      title={t.preview.title}
      unavailable={t.preview.unavailable}
    />
  </div>
</section>
