<script lang="ts">
import Icon from "@iconify/svelte"
import ThemeMiniature from "#lib/components/brand/ThemeMiniature.svelte"
import type { Copy } from "#lib/server/copy.js"
import { themePreview } from "#lib/store/themePreview.svelte.js"
import Section from "./Section.svelte"

let { t }: { t: Copy["themes"] } = $props()
</script>

<Section id="themes" title={t.title} body={t.body} split>
  <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
    {#each t.tiles as tile (tile.id)}
      {@const pressed = themePreview.shows(tile.id)}

      <li class="min-w-0">
        <button
          type="button"
          class="group flex w-full cursor-pointer flex-col gap-2 text-start"
          aria-label={tile.label}
          aria-pressed={pressed}
          onclick={() => themePreview.toggle(tile, t.fallback)}
        >
          <span
            aria-hidden="true"
            class={[
              "relative block aspect-video overflow-hidden rounded-field border-2",
              "transition-colors",
              pressed
                ? "border-primary"
                : "border-base-content/15 group-hover:border-base-content/40",
            ]}
          >
            <ThemeMiniature theme={tile.dark} t={t.miniature} />

            <span class="absolute inset-y-0 end-0 w-1/2 overflow-hidden">
              <span class="absolute inset-y-0 end-0 -start-full">
                <ThemeMiniature theme={tile.light} t={t.miniature} />
              </span>
            </span>
          </span>

          <span class="flex items-center gap-1.5">
            <span
              class={[
                "min-w-0 truncate font-medium text-sm transition-colors",
                pressed && "text-primary",
              ]}
              title={tile.name}
            >
              {tile.name}
            </span>

            <span
              class={[
                "shrink-0 text-primary transition-opacity",
                !pressed && "opacity-0",
              ]}
            >
              <Icon icon="lucide:check" class="size-4" />
            </span>
          </span>
        </button>
      </li>
    {/each}
  </ul>
</Section>
