<script lang="ts">
import ThemeMiniature from "#lib/components/brand/ThemeMiniature.svelte"
import type { Copy } from "#lib/server/copy.js"
import Section from "./Section.svelte"

let { t }: { t: Copy["themes"] } = $props()
</script>

<Section id="themes" eyebrow={t.eyebrow} title={t.title} body={t.body} split>
  <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {#each t.tiles as tile (tile.id)}
      <li class="flex min-w-0 flex-col gap-2">
        <span
          role="img"
          aria-label={tile.label}
          class={[
            "relative block aspect-video overflow-hidden rounded-field border",
            "border-base-content/15",
          ]}
        >
          <ThemeMiniature theme={tile.dark} />

          <span class="absolute inset-y-0 end-0 w-1/2 overflow-hidden">
            <span class="absolute inset-y-0 end-0 -start-full">
              <ThemeMiniature theme={tile.light} />
            </span>
          </span>
        </span>

        <span class="truncate font-medium text-sm" title={tile.name}>
          {tile.name}
        </span>
      </li>
    {/each}
  </ul>
</Section>
