<script lang="ts">
import Icon from "@iconify/svelte"
import { FEATURE_ICONS } from "#lib/landing/icons.js"
import type { Copy } from "#lib/server/copy.js"
import Section from "./Section.svelte"

let { t }: { t: Copy["features"] } = $props()
</script>

<Section id="features" eyebrow={t.eyebrow} title={t.title}>
  <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each t.items as item (item.id)}
      <li
        class={[
          "panel-surface flex flex-col gap-3 rounded-box border p-6",
          "border-base-content/10",
        ]}
      >
        <div class="flex items-center justify-between">
          <Icon icon={FEATURE_ICONS[item.id]} class="size-6 text-primary" />
          <span class="text-primary text-xs tabular-nums">{item.number}</span>
        </div>

        <h3 class="wrap-break-word font-bold text-lg">{item.title}</h3>
        <p class="text-base-content/70 text-sm">{item.body}</p>
      </li>
    {/each}
  </ul>
</Section>
