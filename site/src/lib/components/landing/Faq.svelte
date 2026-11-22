<script lang="ts">
import type { Copy } from "#lib/server/copy.js"
import Section from "./Section.svelte"

let { t }: { t: Copy["faq"] } = $props()
</script>

<Section id="faq" eyebrow={t.eyebrow} title={t.title}>
  <dl class="grid gap-3 md:grid-cols-2">
    {#each t.items as item (item.id)}
      <div
        class={[
          "flex flex-col gap-2 rounded-box border p-6 md:last:col-span-2",
          "border-base-content/10 bg-base-100/50",
        ]}
      >
        <dt class="font-bold">{item.question}</dt>
        <dd class="text-base-content/70 text-sm">{item.answer}</dd>
      </div>
    {/each}
  </dl>
</Section>
